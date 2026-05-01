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
PROMPT_CACHE_VERSION = "v3"


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


def _normalize_label(value: str | None) -> str | None:
    if not value or not isinstance(value, str):
        return None
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    return normalized or None


def _normalize_specialization(value: str | None) -> str | None:
    normalized = _normalize_label(value)
    if not normalized:
        return "academic_research" # Mặc định nếu không xác định được

    # Mapping các chuyên ngành ngách về Broad Categories
    alias_map = {
        # 1. AI & Computer Science
        "computer_science": "ai_computer_science",
        "cs": "ai_computer_science",
        "comp_sci": "ai_computer_science",
        "artificial_intelligence": "ai_computer_science",
        "ai": "ai_computer_science",
        "machine_learning": "ai_computer_science",
        "ml": "ai_computer_science",
        "deep_learning": "ai_computer_science",
        "nlp": "ai_computer_science",
        "machine_translation": "ai_computer_science",
        "neural_networks": "ai_computer_science",
        "llm": "ai_computer_science",
        "software_engineering": "ai_computer_science",

        # 2. Economics & Business
        "economics": "economics_business",
        "business": "economics_business",
        "finance": "economics_business",
        "marketing": "economics_business",
        "accounting": "economics_business",
        "statistical_forecasting": "economics_business",
        "forecasting": "economics_business",

        # 3. Healthcare & Medicine
        "medicine": "healthcare_medicine",
        "medical": "healthcare_medicine",
        "healthcare": "healthcare_medicine",
        "biomedicine": "healthcare_medicine",
        "biomedical": "healthcare_medicine",
        "anatomy": "healthcare_medicine",
        "pharmacy": "healthcare_medicine",

        # 4. Math & Data Science
        "mathematics": "math_data_science",
        "math": "math_data_science",
        "optimization": "math_data_science",
        "statistics": "math_data_science",
        "data_science": "math_data_science",

        # 5. Science & Engineering
        "engineering": "science_engineering",
        "physics": "science_engineering",
        "chemistry": "science_engineering",
        "natural_science": "science_engineering",

        # 6. Social Sciences & Humanities
        "psychology": "social_sciences",
        "law": "social_sciences",
        "linguistics": "social_sciences",
        "history": "social_sciences",

        # 7. Academic & Research (Bao gồm các phương pháp luận chung)
        "academic": "academic_research",
        "research": "academic_research",
        "research_methodology": "academic_research",
        "general": "academic_research"
    }
    
    return alias_map.get(normalized, "academic_research") # Fallback về academic_research nếu có từ lạ


def _normalize_difficulty(value: str | None) -> str | None:
    normalized = _normalize_label(value)
    if not normalized:
        return None

    alias_map = {
        "beginner": "basic",
        "elementary": "basic",
        "easy": "basic",
        "medium": "intermediate",
        "moderate": "intermediate",
        "hard": "advanced",
        "expert": "advanced",
    }
    return alias_map.get(normalized, normalized)


def _normalize_vocab_payload(payload: dict) -> dict:
    return {
        "vietnamese_translation": (payload.get("vietnamese_translation") or "").strip(),
        "en_explanation": (payload.get("en_explanation") or "").strip(),
        "vi_explanation": (payload.get("vi_explanation") or "").strip(),
        "part_of_speech": (payload.get("part_of_speech") or "").strip(),
        "specialization": _normalize_specialization(payload.get("specialization")),
        "difficulty": _normalize_difficulty(payload.get("difficulty")),
    }

ENGLISH_LEVEL_MAP = {
    "A1-A2": "Người mới bắt đầu (A1 - A2 / IELTS < 4.0) - Cần giải thích đơn giản, dễ hiểu.",
    "B1": "Trung bình (B1 / IELTS 4.0 - 5.0 / TOEIC 450 - 600) - Đã có nền tảng cơ bản, cần giải thích từ vựng trung cấp.",
    "B2": "Khá (B2 / IELTS 5.5 - 6.5 / TOEIC 600 - 750) - Có khả năng đọc hiểu tốt, chỉ cần giải thích các từ vựng khó hoặc học thuật.",
    "C1": "Cao cấp (C1 / IELTS 7.0 - 8.0 / TOEIC > 750) - Gần như thông thạo, chỉ cần giải thích các thuật ngữ chuyên ngành sâu.",
    "C2": "Thành thạo (C2 / IELTS 8.5 - 9.0) - Trình độ bản xứ, chỉ cần giải thích các khái niệm cực kỳ chuyên sâu và hẹp.",
}

explain_sem = asyncio.Semaphore(5)


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
                # Parse và trả về trực tiếp, không qua bước Regex
                data = json.loads(response.choices[0].message.content)
                return _normalize_vocab_payload(data)
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
        f"[ID_{i}] {el.html_context if el.html_context else el.text_context}"
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
            # Parse trực tiếp từ chuỗi JSON
            data = json.loads(content)

            translations = data.get("translations", [])
            result = []
            for item in translations:
                if isinstance(item, dict) and "id" in item and "translation" in item:
                    try:
                        idx = int(str(item["id"]).replace("ID_", ""))
                        result.append({"index": idx, "translation": item["translation"]})
                    except ValueError:
                        pass
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
