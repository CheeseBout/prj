import datetime
import json
import re

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import User, UserVocabProgress, Vocabulary, get_db
from schemas import ManualTranslateRequest, ProgressUpdate
from services.llm_service import call_llm_for_explanation
from services.nlp_service import generate_cache_key
from utils.cache import cache_state, redis_client
from utils.security import get_current_user

router = APIRouter()


def _trim_text(value: str | None, max_len: int = 1000) -> str | None:
    if not value:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    return cleaned[:max_len]


def _infer_specialization(word: str, context: str) -> str:
    source = f"{word} {context}".lower()
    if re.search(r"(algorithm|model|database|system|software|code|neural|api)", source):
        return "technology"
    if re.search(r"(market|finance|economic|revenue|portfolio|trade|asset)", source):
        return "business"
    if re.search(r"(biology|physics|chemistry|forecast|probability|experiment|clinical)", source):
        return "science"
    return "general"


def _infer_difficulty(word: str, context: str) -> str:
    word_len = len(word.strip())
    context_len = len([token for token in re.split(r"\s+", context.strip()) if token])
    if word_len <= 6 and context_len <= 14:
        return "basic"
    if word_len >= 11 or context_len >= 28:
        return "advanced"
    return "intermediate"


async def _save_manual_lookup(
    db: AsyncSession,
    current_user: User,
    word: str,
    context: str,
    translation: str | None,
):
    vocab_result = await db.execute(select(Vocabulary).where(Vocabulary.word == word))
    vocab_item = vocab_result.scalar_one_or_none()
    if not vocab_item:
        vocab_item = Vocabulary(word=word)
        db.add(vocab_item)
        await db.flush()

    progress_result = await db.execute(
        select(UserVocabProgress).where(
            UserVocabProgress.user_id == current_user.user_id,
            UserVocabProgress.vocab_id == vocab_item.id,
        )
    )
    progress = progress_result.scalar_one_or_none()

    specialization = _infer_specialization(word, context)
    difficulty = _infer_difficulty(word, context)
    context_value = _trim_text(context)
    translation_value = _trim_text(translation)

    if not progress:
        progress = UserVocabProgress(
            user_id=current_user.user_id,
            vocab_id=vocab_item.id,
            status="unseen",
            context=context_value,
            translation=translation_value,
            specialization=specialization,
            difficulty=difficulty,
            next_review_date=datetime.datetime.utcnow(),
        )
        db.add(progress)
    else:
        if not progress.context and context_value:
            progress.context = context_value
        if not progress.translation and translation_value:
            progress.translation = translation_value
        if not progress.specialization:
            progress.specialization = specialization
        if not progress.difficulty:
            progress.difficulty = difficulty

    await db.commit()


@router.post("/update-progress")
async def update_progress(
    data: ProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vocab_result = await db.execute(select(Vocabulary).where(Vocabulary.word == data.word))
    vocab_item = vocab_result.scalar_one_or_none()

    if not vocab_item:
        vocab_item = Vocabulary(word=data.word)
        db.add(vocab_item)
        await db.flush()

    query = select(UserVocabProgress).where(
        UserVocabProgress.user_id == current_user.user_id,
        UserVocabProgress.vocab_id == vocab_item.id,
    )
    res = await db.execute(query)
    progress = res.scalar_one_or_none()

    if not progress:
        progress = UserVocabProgress(
            user_id=current_user.user_id,
            vocab_id=vocab_item.id,
            status="learning",
            repetitions=0,
            interval_days=0,
        )
        db.add(progress)

    if data.quality >= 4:
        progress.repetitions += 1
        progress.status = "mastered" if progress.repetitions >= 3 else "learning"
        progress.interval_days = (progress.interval_days * 2) + 1
        progress.next_review_date = datetime.datetime.utcnow() + datetime.timedelta(
            days=progress.interval_days
        )
    elif data.quality >= 0:
        progress.repetitions = 0
        progress.interval_days = 1
        progress.next_review_date = datetime.datetime.utcnow() + datetime.timedelta(days=1)
        progress.status = "learning"

    if data.context:
        progress.context = data.context
    if data.translation:
        progress.translation = data.translation

    await db.commit()

    return {"status": "success", "new_status": progress.status}


@router.post("/translate-manual")
async def translate_manual(
    request: ManualTranslateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    word = request.word.strip()
    context = request.context.strip()

    cache_key = generate_cache_key(context, word, request.english_level)
    cached_data = None

    if redis_client and cache_state.is_available:
        try:
            cached_data = await redis_client.get(cache_key)
        except Exception:
            cache_state.is_available = False

    if cached_data:
        payload = json.loads(cached_data)
        await _save_manual_lookup(
            db=db,
            current_user=current_user,
            word=word,
            context=context,
            translation=payload.get("vietnamese_translation"),
        )
        return {**payload, "status": "success"}

    llm_data = await call_llm_for_explanation(word, context, request.english_level)

    if llm_data:
        if redis_client and cache_state.is_available:
            try:
                await redis_client.setex(cache_key, 604800, json.dumps(llm_data))
            except Exception:
                pass

        await _save_manual_lookup(
            db=db,
            current_user=current_user,
            word=word,
            context=context,
            translation=llm_data.get("vietnamese_translation"),
        )
        return {**llm_data, "status": "success"}

    return {"status": "error", "message": "Failed to translate"}
