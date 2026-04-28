import asyncio
import datetime
import json
import re

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import User, UserVocabProgress, Vocabulary, get_db
from schemas import ScanElement, ScanPayload
from services.llm_service import call_llm_for_explanation, translate_elements_inline
from services.nlp_service import (
    extract_keywords_llm,
    generate_cache_key,
    generate_extract_cache_key,
)
from utils.cache import cache_state, redis_client
from utils.logger import append_json_log
from utils.security import get_current_user

router = APIRouter()

@router.post("/scan")
async def scan_vocabulary(
    request: ScanPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = []
    total_elements = len(request.elements)

    async def get_keywords(text: str, level: str):
        cache_key = generate_extract_cache_key(text, level)
        if redis_client is not None and cache_state.is_available:
            try:
                cached = await redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                cache_state.is_available = False

        keywords = await extract_keywords_llm(text, level)

        if redis_client is not None and cache_state.is_available:
            try:
                await redis_client.setex(cache_key, 604800, json.dumps(keywords))
            except Exception:
                pass
        return keywords

    extract_tasks = [
        get_keywords(element.text_context, request.english_level) for element in request.elements
    ]
    extracted_keywords_per_element = await asyncio.gather(*extract_tasks)

    all_found_keywords = set()
    for keywords in extracted_keywords_per_element:
        all_found_keywords.update(keywords)

    if not all_found_keywords:
        return {"status": "success", "processed_elements": total_elements, "highlights": []}

    query = (
        select(Vocabulary.word, UserVocabProgress.status)
        .join(UserVocabProgress, Vocabulary.id == UserVocabProgress.vocab_id)
        .where(
            UserVocabProgress.user_id == current_user.user_id,
            Vocabulary.word.in_(list(all_found_keywords)),
        )
    )
    db_result = await db.execute(query)
    user_knowledge_dict = {row.word: row.status for row in db_result}

    tasks = []
    task_meta = []

    for idx, element in enumerate(request.elements):
        text = element.text_context
        elem_keywords = extracted_keywords_per_element[idx]

        for word in elem_keywords:
            user_state = user_knowledge_dict.get(word, "unseen")
            if user_state == "mastered":
                continue

            cache_key = generate_cache_key(text, word, request.english_level)
            cached_data = None

            if redis_client is not None and cache_state.is_available:
                try:
                    cached_data = await redis_client.get(cache_key)
                except Exception:
                    cache_state.is_available = False

            if cached_data:
                llm_data = json.loads(cached_data)
                match = re.search(r"\b" + re.escape(word) + r"\b", text, re.IGNORECASE)
                if match:
                    results.append(
                        {
                            "element_id": element.element_id,
                            "target_word": word,
                            "vietnamese_translation": llm_data.get("vietnamese_translation", ""),
                            "en_explanation": llm_data.get("en_explanation", ""),
                            "vi_explanation": llm_data.get("vi_explanation", ""),
                            "startIndex": match.start(),
                            "endIndex": match.start() + len(word),
                            "knowledge_state": user_state,
                        }
                    )

                    # Update: cache context tam thoi cho user (Hit Cache)
                    if redis_client is not None and cache_state.is_available:
                        try:
                            user_context_key = f"user_context:{current_user.user_id}:{word}"
                            context_payload = {
                                "context": text,
                                "translation": llm_data.get("vietnamese_translation", ""),
                                "specialization": llm_data.get("specialization"),
                                "difficulty": llm_data.get("difficulty"),
                            }
                            await redis_client.setex(user_context_key, 86400, json.dumps(context_payload))
                        except Exception:
                            pass
            else:
                tasks.append(call_llm_for_explanation(word, text, request.english_level))
                task_meta.append(
                    {
                        "element": element,
                        "word": word,
                        "cache_key": cache_key,
                        "user_state": user_state,
                    }
                )

    if tasks:
        llm_results = await asyncio.gather(*tasks, return_exceptions=True)
        for meta, llm_data in zip(task_meta, llm_results):
            if isinstance(llm_data, Exception) or not llm_data:
                continue

            if redis_client is not None and cache_state.is_available:
                try:
                    await redis_client.setex(meta["cache_key"], 604800, json.dumps(llm_data))

                    # Update: cache context tam thoi cho user (Fresh LLM)
                    user_context_key = f"user_context:{current_user.user_id}:{meta['word']}"
                    context_payload = {
                        "context": meta["element"].text_context,
                        "translation": llm_data.get("vietnamese_translation", ""),
                        "specialization": llm_data.get("specialization"),
                        "difficulty": llm_data.get("difficulty"),
                    }
                    await redis_client.setex(user_context_key, 86400, json.dumps(context_payload))
                except Exception:
                    pass

            text = meta["element"].text_context
            match = re.search(r"\b" + re.escape(meta["word"]) + r"\b", text, re.IGNORECASE)
            if match:
                results.append(
                    {
                        "element_id": meta["element"].element_id,
                        "target_word": meta["word"],
                        "vietnamese_translation": llm_data.get("vietnamese_translation", ""),
                        "en_explanation": llm_data.get("en_explanation", ""),
                        "vi_explanation": llm_data.get("vi_explanation", ""),
                        "startIndex": match.start(),
                        "endIndex": match.start() + len(meta["word"]),
                        "knowledge_state": meta["user_state"],
                    }
                )

    return {"status": "success", "processed_elements": total_elements, "highlights": results}

@router.post("/scan-inline")
async def scan_inline(payload: ScanPayload):
    payload_raw = payload.model_dump()
    elements = payload.elements
    if payload.text and not elements:
        elements = [ScanElement(element_id="legacy-text", text_context=payload.text)]

    log_entry = {
        "event": "scan_inline_request_received",
        "timestamp": datetime.datetime.now().isoformat(),
        "request_payload": payload_raw,
        "url": payload.url,
        "elements_count": len(elements),
        "elements": [element.model_dump() for element in elements],
    }
    await append_json_log(log_entry)

    translations_raw = await translate_elements_inline(elements)

    translations = [
        {
            "element_id": elements[item["index"]].element_id,
            "translated_text": item["translation"],
        }
        for item in translations_raw
        if 0 <= item["index"] < len(elements)
    ]

    return {"status": "success", "highlights": [], "translations": translations}


