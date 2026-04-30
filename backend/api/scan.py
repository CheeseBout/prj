import asyncio
import datetime
import json
import re

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import User, UserVocabProgress, Vocabulary, get_db
from schemas import ScanElement, ScanPayload
from services.llm_service import translate_elements_inline
from services.nlp_service import (
    extract_keywords_llm,
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
    """
    Endpoint quét từ vựng: Trích xuất và giải thích thuật ngữ trong 1 lần gọi LLM.
    """
    results = []
    total_elements = len(request.elements)

    async def get_keywords_data(text: str, level: str):
        """
        Hàm bổ trợ để lấy dữ liệu thuật ngữ (đã kèm giải thích) từ Cache hoặc LLM.
        """
        cache_key = generate_extract_cache_key(text, level)
        if redis_client is not None and cache_state.is_available:
            try:
                cached = await redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                cache_state.is_available = False

        # Gọi hàm mới trong nlp_service.py trả về list[dict] thay vì list[str]
        highlights_data = await extract_keywords_llm(text, level)

        if redis_client is not None and cache_state.is_available:
            try:
                # Cache kết quả trích xuất kèm giải thích trong 7 ngày
                await redis_client.setex(cache_key, 604800, json.dumps(highlights_data))
            except Exception:
                pass
        return highlights_data

    # Bước 1: Gọi LLM (hoặc Cache) song song cho tất cả các phần tử văn bản
    extract_tasks = [
        get_keywords_data(element.text_context, request.english_level) 
        for element in request.elements
    ]
    all_elements_highlights = await asyncio.gather(*extract_tasks)

    # Bước 2: Thu thập tất cả các từ tìm được để kiểm tra trạng thái trong Database
    all_found_words = set()
    for highlights in all_elements_highlights:
        for hl in highlights:
            all_found_words.add(hl.get("target_word"))

    if not all_found_words:
        return {"status": "success", "processed_elements": total_elements, "highlights": []}

    # Truy vấn trạng thái học tập của user cho các từ này
    query = (
        select(Vocabulary.word, UserVocabProgress.status)
        .join(UserVocabProgress, Vocabulary.id == UserVocabProgress.vocab_id)
        .where(
            UserVocabProgress.user_id == current_user.user_id,
            Vocabulary.word.in_(list(all_found_words)),
        )
    )
    db_result = await db.execute(query)
    user_knowledge_dict = {row.word: row.status for row in db_result}

    # Bước 3: Tổng hợp kết quả cuối cùng
    for idx, element in enumerate(request.elements):
        text = element.text_context
        element_highlights = all_elements_highlights[idx]

        for hl_data in element_highlights:
            word = hl_data.get("target_word")
            if not word:
                continue

            user_state = user_knowledge_dict.get(word, "unseen")
            
            # Bỏ qua nếu user đã thành thạo từ này
            if user_state == "mastered":
                continue

            # Xác định vị trí từ trong văn bản để frontend highlight
            match = re.search(r"\b" + re.escape(word) + r"\b", text, re.IGNORECASE)
            if match:
                results.append(
                    {
                        "element_id": element.element_id,
                        "target_word": word,
                        "vietnamese_translation": hl_data.get("vietnamese_translation", ""),
                        "en_explanation": hl_data.get("en_explanation", ""),
                        "vi_explanation": hl_data.get("vi_explanation", ""),
                        "startIndex": match.start(),
                        "endIndex": match.start() + len(word),
                        "knowledge_state": user_state,
                    }
                )

                # Cập nhật cache ngữ cảnh tạm thời cho User (để phục vụ việc học sau này)
                if redis_client is not None and cache_state.is_available:
                    try:
                        user_context_key = f"user_context:{current_user.user_id}:{word}"
                        context_payload = {
                            "context": text,
                            "translation": hl_data.get("vietnamese_translation", ""),
                            "en_explanation": hl_data.get("en_explanation", ""),
                            "vi_explanation": hl_data.get("vi_explanation", ""),
                            "specialization": hl_data.get("specialization"),
                            "difficulty": hl_data.get("difficulty"),
                        }
                        await redis_client.setex(user_context_key, 86400, json.dumps(context_payload))
                    except Exception:
                        pass

    return {"status": "success", "processed_elements": total_elements, "highlights": results}

@router.post("/scan-inline")
async def scan_inline(payload: ScanPayload):
    """
    Endpoint dịch chèn dòng (Inline Translation).
    """
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