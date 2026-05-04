import asyncio
import hashlib
import json
import random
import re
from typing import Any

from config import OPENAI_MODEL
from services.llm_service import llm_client

QUESTION_TYPE_MEANING_MCQ_EN = "meaning_mcq_en"
QUESTION_PROMPT_VERSION = "mcq_en_v1"

_question_sem = asyncio.Semaphore(4)


def build_question_fingerprint(
    word: str,
    translation: str | None,
    en_explanation: str | None,
    vi_explanation: str | None,
    specialization: str | None,
    difficulty: str | None,
    prompt_version: str = QUESTION_PROMPT_VERSION,
) -> str:
    raw = "||".join(
        [
            (word or "").strip().lower(),
            (translation or "").strip().lower(),
            (en_explanation or "").strip().lower(),
            (vi_explanation or "").strip().lower(),
            (specialization or "").strip().lower(),
            (difficulty or "").strip().lower(),
            prompt_version,
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _sanitize_text(value: str | None, max_len: int = 1200) -> str:
    if not value:
        return ""
    cleaned = re.sub(r"\s+", " ", value).strip()
    if len(cleaned) > max_len:
        return cleaned[:max_len]
    return cleaned


def _normalize_choice(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def _validate_mcq_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
    stem = _sanitize_text(payload.get("stem"), 600)
    choices_raw = payload.get("choices")
    correct_index = payload.get("correct_index")
    explanation_en = _sanitize_text(payload.get("explanation_en"), 1200)

    if not stem or not isinstance(choices_raw, list) or len(choices_raw) != 4:
        return None

    if not isinstance(correct_index, int) or correct_index < 0 or correct_index > 3:
        return None

    choices = []
    seen = set()
    for item in choices_raw:
        if not isinstance(item, str):
            return None
        normalized = _normalize_choice(item)
        if not normalized:
            return None
        key = normalized.lower()
        if key in seen:
            return None
        seen.add(key)
        choices.append(normalized)

    return {
        "stem": stem,
        "choices": choices,
        "correct_index": correct_index,
        "explanation_en": explanation_en,
    }


def _build_fallback_question(
    word: str,
    translation: str | None,
    en_explanation: str | None,
) -> dict[str, Any]:
    correct = _sanitize_text(en_explanation, 180) or _sanitize_text(translation, 120) or "A meaning related to this word"
    if not correct:
        correct = "A meaning related to this word"

    distractors = [
        "A method for reducing long-term memory load",
        "A process of changing physical material composition",
        "A legal framework for corporate taxation policy",
        "A communication style focused on emotional persuasion",
        "A mathematical operation for geometric transformation",
    ]
    cleaned_distractors = [d for d in distractors if d.lower() != correct.lower()][:3]
    choices = [correct, *cleaned_distractors]

    return {
        "stem": f"Which option best matches the meaning of '{word}'?",
        "choices": choices,
        "correct_index": 0,
        "explanation_en": "This is an auto-generated fallback question because LLM output was unavailable.",
    }


def shuffle_choices_with_correct_index(
    choices: list[str], correct_index: int
) -> tuple[list[str], int]:
    if not choices or correct_index < 0 or correct_index >= len(choices):
        return choices, correct_index

    correct_choice = choices[correct_index]
    shuffled = choices[:]
    random.shuffle(shuffled)
    new_index = shuffled.index(correct_choice)
    return shuffled, new_index


def shuffle_mcq_payload(payload: dict[str, Any]) -> dict[str, Any]:
    choices = payload.get("choices")
    correct_index = payload.get("correct_index")
    if not isinstance(choices, list) or not isinstance(correct_index, int):
        return payload
    shuffled_choices, new_index = shuffle_choices_with_correct_index(choices, correct_index)
    payload["choices"] = shuffled_choices
    payload["correct_index"] = new_index
    return payload


async def generate_meaning_mcq_en(
    word: str,
    translation: str | None,
    en_explanation: str | None,
    vi_explanation: str | None,
    specialization: str | None,
    difficulty: str | None,
) -> dict[str, Any]:
    system_prompt = (
        "You are an expert English test-item writer for vocabulary learning. "
        "Return only strict JSON with keys: stem, choices, correct_index, explanation_en. "
        "choices must be an array of exactly 4 distinct English options. "
        "correct_index must be 0..3 and exactly one option must be correct."
    )

    user_prompt = (
        "Create ONE multiple-choice question in English to test the meaning of a vocabulary word.\n"
        f"Word: {word}\n"
        f"Vietnamese translation: {translation or ''}\n"
        f"English explanation: {en_explanation or ''}\n"
        f"Vietnamese explanation: {vi_explanation or ''}\n"
        f"Specialization: {specialization or ''}\n"
        f"Difficulty: {difficulty or ''}\n\n"
        "Requirements:\n"
        "1) The question stem must be concise and unambiguous.\n"
        "2) All options are in English.\n"
        "3) Keep distractors plausible but clearly wrong.\n"
        "4) Do not use 'all of the above' or 'none of the above'.\n"
        "5) Return JSON only."
    )

    async with _question_sem:
        for _ in range(3):
            try:
                response = await llm_client.chat.completions.create(
                    model=OPENAI_MODEL,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                    max_tokens=700,
                )

                content = response.choices[0].message.content or "{}"
                payload = json.loads(content)
                validated = _validate_mcq_payload(payload)
                if validated:
                    return shuffle_mcq_payload(validated)
            except Exception:
                continue

    return shuffle_mcq_payload(
        _build_fallback_question(word=word, translation=translation, en_explanation=en_explanation)
    )
