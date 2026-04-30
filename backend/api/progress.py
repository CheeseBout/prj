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
from services.sm2 import calculate_sm2
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

async def _save_manual_lookup(
    db: AsyncSession,
    current_user: User,
    word: str,
    context: str,
    translation: str | None,
    specialization: str | None, 
    difficulty: str | None,
    en_explanation: str | None = None,
    vi_explanation: str | None = None,
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

    context_value = _trim_text(context)
    translation_value = _trim_text(translation)
    en_expl_value = _trim_text(en_explanation, 2000)
    vi_expl_value = _trim_text(vi_explanation, 2000)

    if not progress:
        progress = UserVocabProgress(
            user_id=current_user.user_id,
            vocab_id=vocab_item.id,
            status="unseen",
            context=context_value,
            translation=translation_value,
            specialization=specialization,
            difficulty=difficulty,
            en_explanation=en_expl_value,
            vi_explanation=vi_expl_value,
            next_review_date=datetime.datetime.utcnow(),
        )
        db.add(progress)
    else:
        if not progress.context and context_value:
            progress.context = context_value
        if not progress.translation and translation_value:
            progress.translation = translation_value
        if not progress.specialization and specialization:
            progress.specialization = specialization
        if not progress.difficulty and difficulty:
            progress.difficulty = difficulty
        if not progress.en_explanation and en_expl_value:
            progress.en_explanation = en_expl_value
        if not progress.vi_explanation and vi_expl_value:
            progress.vi_explanation = vi_expl_value

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

    new_specialization = None
    new_difficulty = None
    new_en_explanation = None
    new_vi_explanation = None

    # Kéo dữ liệu Context/Translation/Specialization/Difficulty từ cache nháp ra
    user_context_key = f"user_context:{current_user.user_id}:{data.word}"
    if redis_client and cache_state.is_available:
        try:
            cached_ctx = await redis_client.get(user_context_key)
            if cached_ctx:
                ctx_data = json.loads(cached_ctx)
                if not data.context:
                    data.context = ctx_data.get("context")
                if not data.translation:
                    data.translation = ctx_data.get("translation")
                    
                new_specialization = ctx_data.get("specialization")
                new_difficulty = ctx_data.get("difficulty")
                new_en_explanation = ctx_data.get("en_explanation")
                new_vi_explanation = ctx_data.get("vi_explanation")
        except Exception:
            pass

    # Gán các giá trị
    if data.context:
        progress.context = _trim_text(data.context)
            
    if data.translation:
        progress.translation = _trim_text(data.translation)

    if new_specialization and not progress.specialization:
        progress.specialization = new_specialization
        
    if new_difficulty and not progress.difficulty:
        progress.difficulty = new_difficulty

    if new_en_explanation and not progress.en_explanation:
        progress.en_explanation = _trim_text(new_en_explanation, 2000)

    if new_vi_explanation and not progress.vi_explanation:
        progress.vi_explanation = _trim_text(new_vi_explanation, 2000)

    sm2_result = calculate_sm2(
        repetitions=progress.repetitions,
        interval_days=progress.interval_days,
        ease_factor=progress.ease_factor,
        quality=data.quality,
    )
    progress.repetitions = sm2_result["repetitions"]
    progress.interval_days = sm2_result["interval_days"]
    progress.ease_factor = sm2_result["ease_factor"]
    progress.next_review_date = sm2_result["next_review_date"]
    progress.status = sm2_result["status"]

    # Logic tính toán Streak của người dùng
    today = datetime.datetime.utcnow().date()
    if current_user.last_study_date != today:
        if current_user.last_study_date == today - datetime.timedelta(days=1):
            current_user.current_streak = (current_user.current_streak or 0) + 1
        else:
            current_user.current_streak = 1
            
        current_user.last_study_date = today
        db.add(current_user)

    await db.commit()

    return {
        "status": "success",
        "new_status": progress.status,
        "quality": sm2_result["quality"],
        "repetitions": progress.repetitions,
        "interval_days": progress.interval_days,
        "ease_factor": progress.ease_factor,
        "next_review_date": progress.next_review_date.isoformat(),
    }

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
            specialization=payload.get("specialization"),
            difficulty=payload.get("difficulty"),
            en_explanation=payload.get("en_explanation"),
            vi_explanation=payload.get("vi_explanation"),
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
            specialization=llm_data.get("specialization"),
            difficulty=llm_data.get("difficulty"),
            en_explanation=llm_data.get("en_explanation"),
            vi_explanation=llm_data.get("vi_explanation"),
        )
        return {**llm_data, "status": "success"}

    return {"status": "error", "message": "Failed to translate"}
