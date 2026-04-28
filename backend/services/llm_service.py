import asyncio
import hashlib
import json
import os
import re

from openai import AsyncOpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL
from schemas import ScanElement

llm_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(BASE_DIR, "system_prompt.json")

_PROMPTS_CACHE = {}
_PROMPTS_MTIME = None
PROMPT_CACHE_VERSION = "v2"


def load_prompts():
    try:
        with open(PROMPTS_DIR, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"LLM Error (Prompts): {e}")
        return {}


def get_prompts():
    global _PROMPTS_CACHE, _PROMPTS_MTIME
    try:
        mtime = os.path.getmtime(PROMPTS_DIR)
    except OSError:
        mtime = None

    if not _PROMPTS_CACHE or _PROMPTS_MTIME != mtime:
        _PROMPTS_CACHE = load_prompts()
        _PROMPTS_MTIME = mtime

    return _PROMPTS_CACHE


def get_prompt_cache_version() -> str:
    prompts = get_prompts()
    serialized = json.dumps(prompts, sort_keys=True, ensure_ascii=False)
    digest = hashlib.md5(serialized.encode("utf-8")).hexdigest()[:12]
    return f"{PROMPT_CACHE_VERSION}:{digest}"


PROMPTS = get_prompts()

ENGLISH_LEVEL_MAP = {
    "A1-A2": "Người mới bắt đầu (A1 - A2 / IELTS < 4.0) - Cần giải thích đơn giản, dễ hiểu.",
    "B1": "Trung bình (B1 / IELTS 4.0 - 5.0 / TOEIC 450 - 600) - Đã có nền tảng cơ bản, cần giải thích từ vựng trung cấp.",
    "B2": "Khá (B2 / IELTS 5.5 - 6.5 / TOEIC 600 - 750) - Có khả năng đọc hiểu tốt, chỉ cần giải thích các từ vựng khó hoặc học thuật.",
    "C1": "Cao cấp (C1 / IELTS 7.0 - 8.0 / TOEIC > 750) - Gần như thông thạo, chỉ cần giải thích các thuật ngữ chuyên ngành sâu.",
    "C2": "Thành thạo (C2 / IELTS 8.5 - 9.0) - Trình độ bản xứ, chỉ cần giải thích các khái niệm cực kỳ chuyên sâu và hẹp.",
}

explain_sem = asyncio.Semaphore(3)

TERM_NORMALIZATION_RULES = [
    (r"\bch[uú]\s*y\s*đa\s*đầu\b", "Multi-Head Attention"),
    (r"\bmạng\s*nhớ\s*đầu\s*-\s*cuối\b", "end-to-end memory networks"),
    (r"\bmạng\s*nhớ\s*đầu\s*cuối\b", "end-to-end memory networks"),
]


def normalize_academic_translation(text: str | None) -> str | None:
    if not isinstance(text, str) or not text:
        return text

    normalized = text
    for pattern, replacement in TERM_NORMALIZATION_RULES:
        normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
    return normalized


def normalize_llm_payload(payload: dict | None) -> dict | None:
    if not isinstance(payload, dict):
        return payload

    if "vietnamese_translation" in payload:
        payload["vietnamese_translation"] = normalize_academic_translation(
            payload.get("vietnamese_translation")
        )

    if isinstance(payload.get("translations"), list):
        for item in payload["translations"]:
            if isinstance(item, dict) and "translation" in item:
                item["translation"] = normalize_academic_translation(item.get("translation"))

    return payload


async def call_llm_for_explanation(
    target_word: str, context: str, english_level: str = "cơ bản"
) -> dict:
    vocab_prompts = get_prompts().get("vocab_explanation", {})
    system_prompt = vocab_prompts.get("system", "You are a helpful academic JSON API.")
    user_template = vocab_prompts.get("user", "")

    mapped_level = ENGLISH_LEVEL_MAP.get(english_level, english_level)
    prompt = user_template.format(
        english_level=mapped_level,
        context=context,
        target_word=target_word,
    )

    async with explain_sem:
        for attempt in range(4):
            try:
                response = await llm_client.chat.completions.create(
                    model=OPENAI_MODEL,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.1,
                    max_tokens=800,
                )
                return normalize_llm_payload(json.loads(response.choices[0].message.content))
            except Exception as e:
                print(f"LLM Error (Vocab) Attempt {attempt+1}: {e}")
                if "429" in str(e) and attempt < 3:
                    wait_time = 2**attempt
                    match = re.search(r"try again in (\d+(?:\.\d+)?)(ms|s)", str(e))
                    if match:
                        val = float(match.group(1))
                        if match.group(2) == "ms":
                            val /= 1000.0
                        wait_time = val + 0.5
                    await asyncio.sleep(wait_time)
                    continue
                return None
        return None


async def translate_elements_inline(elements: list[ScanElement]) -> list[dict]:
    if not elements:
        return []

    items = "\n".join(
        f"[{i}] {el.html_context if el.html_context else el.text_context}"
        for i, el in enumerate(elements)
    )

    inline_prompts = get_prompts().get("inline_translation", {})
    system_prompt = inline_prompts.get("system", "")

    for attempt in range(4):
        try:
            response = await llm_client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": items},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=2000,
            )
            content = response.choices[0].message.content or "{}"
            data = normalize_llm_payload(json.loads(content))

            translations = data.get("translations", [])
            result = []
            for item in translations:
                if isinstance(item, dict) and "index" in item and "translation" in item:
                    result.append({"index": item["index"], "translation": item["translation"]})
            return result
        except Exception as e:
            print(f"LLM Error (Inline) Attempt {attempt+1}: {e}")
            if "429" in str(e) and attempt < 3:
                wait_time = 2**attempt
                match = re.search(r"try again in (\d+(?:\.\d+)?)(ms|s)", str(e))
                if match:
                    val = float(match.group(1))
                    if match.group(2) == "ms":
                        val /= 1000.0
                    wait_time = val + 0.5
                await asyncio.sleep(wait_time)
                continue
            return []
    return []
