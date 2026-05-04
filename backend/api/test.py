import datetime
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import (
    QuestionBank,
    Tag,
    User,
    UserQuestionAttempt,
    UserVocabProgress,
    VocabTag,
    Vocabulary,
    get_db,
)
from services.question_bank_service import (
    QUESTION_PROMPT_VERSION,
    QUESTION_TYPE_MEANING_MCQ_EN,
    build_question_fingerprint,
    generate_meaning_mcq_en,
    shuffle_choices_with_correct_index,
)
from services.sm2 import calculate_sm2
from utils.security import get_current_user

router = APIRouter()


class TestStartRequest(BaseModel):
    count: int = Field(default=10, ge=1, le=50)
    specialization: Optional[str] = None
    tag: Optional[str] = None
    due_only: bool = True


class TestAnswerRequest(BaseModel):
    question_id: int
    selected_index: int = Field(..., ge=0)
    response_time_ms: Optional[int] = Field(default=None, ge=0)


def _map_quality(is_correct: bool, response_time_ms: int | None) -> int:
    if is_correct:
        if response_time_ms is None:
            return 4
        if response_time_ms <= 4000:
            return 5
        if response_time_ms <= 9000:
            return 4
        return 3
    if response_time_ms is not None and response_time_ms > 15000:
        return 0
    return 1


def _safe_parse_choices(choices_json: str) -> list[str]:
    try:
        parsed = json.loads(choices_json)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except Exception:
        pass
    return []


def _apply_streak_logic(current_user: User):
    today = datetime.datetime.utcnow().date()
    if current_user.last_study_date == today:
        return
    if current_user.last_study_date == today - datetime.timedelta(days=1):
        current_user.current_streak = (current_user.current_streak or 0) + 1
    else:
        current_user.current_streak = 1
    current_user.last_study_date = today


def _needs_shuffle_upgrade(question: QuestionBank) -> bool:
    if question.correct_index != 0:
        return False
    if not question.choices_json:
        return False
    if question.created_at is None or question.updated_at is None:
        return True
    return question.created_at == question.updated_at


def _shuffle_question_in_place(question: QuestionBank) -> bool:
    choices = _safe_parse_choices(question.choices_json)
    if len(choices) != 4:
        return False
    if question.correct_index < 0 or question.correct_index >= len(choices):
        return False
    shuffled_choices, new_correct_index = shuffle_choices_with_correct_index(
        choices=choices,
        correct_index=question.correct_index,
    )
    question.choices_json = json.dumps(shuffled_choices, ensure_ascii=False)
    question.correct_index = new_correct_index
    return True


async def _get_or_create_question_for_vocab(
    db: AsyncSession,
    vocab_row,
) -> QuestionBank:
    fingerprint = build_question_fingerprint(
        word=vocab_row.word,
        translation=vocab_row.translation,
        en_explanation=vocab_row.en_explanation,
        vi_explanation=vocab_row.vi_explanation,
        specialization=vocab_row.specialization,
        difficulty=vocab_row.difficulty,
        prompt_version=QUESTION_PROMPT_VERSION,
    )

    existing_res = await db.execute(
        select(QuestionBank).where(
            QuestionBank.vocab_id == vocab_row.vocab_id,
            QuestionBank.question_type == QUESTION_TYPE_MEANING_MCQ_EN,
            QuestionBank.prompt_version == QUESTION_PROMPT_VERSION,
            QuestionBank.content_fingerprint == fingerprint,
            QuestionBank.is_active == True,  # noqa: E712
        )
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        if _needs_shuffle_upgrade(existing):
            _shuffle_question_in_place(existing)
        return existing

    await db.execute(
        update(QuestionBank)
        .where(
            QuestionBank.vocab_id == vocab_row.vocab_id,
            QuestionBank.question_type == QUESTION_TYPE_MEANING_MCQ_EN,
            QuestionBank.is_active == True,  # noqa: E712
        )
        .values(is_active=False)
    )

    generated = await generate_meaning_mcq_en(
        word=vocab_row.word,
        translation=vocab_row.translation,
        en_explanation=vocab_row.en_explanation,
        vi_explanation=vocab_row.vi_explanation,
        specialization=vocab_row.specialization,
        difficulty=vocab_row.difficulty,
    )

    question = QuestionBank(
        vocab_id=vocab_row.vocab_id,
        question_type=QUESTION_TYPE_MEANING_MCQ_EN,
        stem=generated["stem"],
        choices_json=json.dumps(generated["choices"], ensure_ascii=False),
        correct_index=generated["correct_index"],
        explanation_en=generated.get("explanation_en"),
        specialization=vocab_row.specialization,
        difficulty=vocab_row.difficulty,
        prompt_version=QUESTION_PROMPT_VERSION,
        content_fingerprint=fingerprint,
        language="en",
        is_active=True,
    )
    db.add(question)
    await db.flush()
    return question


@router.post("/start")
async def start_test_session(
    payload: TestStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.datetime.utcnow()
    base_query = (
        select(
            Vocabulary.id.label("vocab_id"),
            Vocabulary.word,
            UserVocabProgress.translation,
            UserVocabProgress.en_explanation,
            UserVocabProgress.vi_explanation,
            UserVocabProgress.specialization,
            UserVocabProgress.difficulty,
            UserVocabProgress.next_review_date,
        )
        .join(Vocabulary, UserVocabProgress.vocab_id == Vocabulary.id)
        .where(
            UserVocabProgress.user_id == current_user.user_id,
            Vocabulary.word.isnot(None),
            UserVocabProgress.translation.isnot(None),
        )
    )

    if payload.specialization and payload.specialization != "all":
        base_query = base_query.where(UserVocabProgress.specialization == payload.specialization)

    if payload.tag and payload.tag != "all":
        base_query = (
            base_query.join(
                VocabTag,
                (VocabTag.vocab_id == UserVocabProgress.vocab_id)
                & (VocabTag.user_id == UserVocabProgress.user_id),
            )
            .join(Tag, Tag.id == VocabTag.tag_id)
            .where(Tag.name == payload.tag.strip().lower())
        )

    vocab_rows = []
    if payload.due_only:
        due_query = (
            base_query.where(UserVocabProgress.next_review_date <= now)
            .order_by(UserVocabProgress.next_review_date.asc())
            .limit(payload.count)
        )
        due_res = await db.execute(due_query)
        vocab_rows = list(due_res)

        if len(vocab_rows) < payload.count:
            existing_vocab_ids = [row.vocab_id for row in vocab_rows]
            remaining_query = base_query
            if existing_vocab_ids:
                remaining_query = remaining_query.where(~Vocabulary.id.in_(existing_vocab_ids))
            remaining_query = (
                remaining_query.order_by(UserVocabProgress.next_review_date.asc())
                .limit(payload.count - len(vocab_rows))
            )
            remaining_res = await db.execute(remaining_query)
            vocab_rows.extend(list(remaining_res))
    else:
        all_query = base_query.order_by(UserVocabProgress.next_review_date.asc()).limit(payload.count)
        all_res = await db.execute(all_query)
        vocab_rows = list(all_res)

    if not vocab_rows:
        return {"status": "success", "data": []}

    questions_out = []
    for row in vocab_rows:
        question = await _get_or_create_question_for_vocab(db=db, vocab_row=row)
        choices = _safe_parse_choices(question.choices_json)
        if len(choices) != 4:
            continue
        questions_out.append(
            {
                "question_id": question.id,
                "vocab_id": row.vocab_id,
                "word": row.word,
                "stem": question.stem,
                "choices": choices,
                "specialization": question.specialization,
                "difficulty": question.difficulty,
            }
        )

    await db.commit()
    return {"status": "success", "data": questions_out}


@router.post("/answer")
async def submit_test_answer(
    payload: TestAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question_res = await db.execute(
        select(QuestionBank).where(
            QuestionBank.id == payload.question_id,
            QuestionBank.is_active == True,  # noqa: E712
        )
    )
    question = question_res.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    choices = _safe_parse_choices(question.choices_json)
    if not choices:
        raise HTTPException(status_code=400, detail="Question choices are invalid")

    if payload.selected_index < 0 or payload.selected_index >= len(choices):
        raise HTTPException(status_code=400, detail="Selected index out of range")

    is_correct = payload.selected_index == question.correct_index
    quality = _map_quality(is_correct=is_correct, response_time_ms=payload.response_time_ms)

    progress_res = await db.execute(
        select(UserVocabProgress).where(
            UserVocabProgress.user_id == current_user.user_id,
            UserVocabProgress.vocab_id == question.vocab_id,
        )
    )
    progress = progress_res.scalar_one_or_none()
    if not progress:
        progress = UserVocabProgress(
            user_id=current_user.user_id,
            vocab_id=question.vocab_id,
            status="learning",
            repetitions=0,
            interval_days=0,
            ease_factor=2.5,
            next_review_date=datetime.datetime.utcnow(),
        )
        db.add(progress)
        await db.flush()

    sm2_result = calculate_sm2(
        repetitions=progress.repetitions,
        interval_days=progress.interval_days,
        ease_factor=progress.ease_factor,
        quality=quality,
    )
    progress.repetitions = sm2_result["repetitions"]
    progress.interval_days = sm2_result["interval_days"]
    progress.ease_factor = sm2_result["ease_factor"]
    progress.next_review_date = sm2_result["next_review_date"]
    progress.status = sm2_result["status"]

    _apply_streak_logic(current_user)
    db.add(current_user)

    attempt = UserQuestionAttempt(
        user_id=current_user.user_id,
        question_id=question.id,
        selected_index=payload.selected_index,
        is_correct=is_correct,
        quality_score=quality,
        response_time_ms=payload.response_time_ms,
    )
    db.add(attempt)

    await db.commit()

    return {
        "status": "success",
        "is_correct": is_correct,
        "correct_index": question.correct_index,
        "quality": quality,
        "new_status": progress.status,
        "repetitions": progress.repetitions,
        "interval_days": progress.interval_days,
        "ease_factor": progress.ease_factor,
        "next_review_date": progress.next_review_date.isoformat() if progress.next_review_date else None,
        "explanation_en": question.explanation_en,
    }
