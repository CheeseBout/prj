import asyncio
import hashlib
import json
import re

from config import OPENAI_MODEL
from services.llm_service import (
    ENGLISH_LEVEL_MAP,
    get_prompt_cache_version,
    get_prompts,
    llm_client,
)

# Semaphore giới hạn số lượng tác vụ LLM chạy đồng thời để tránh rate limit
extract_sem = asyncio.Semaphore(5)

async def extract_keywords_llm(text: str, english_level: str) -> list[dict]:
    """
    Trích xuất và giải thích thuật ngữ trong một lần gọi LLM duy nhất.
    Trả về danh sách các object chứa đầy đủ thông tin giải thích.
    """
    prompt_config = get_prompts().get("terminology_extraction", {})
    mapped_level = ENGLISH_LEVEL_MAP.get(english_level, english_level)

    # System prompt lúc này cần được cấu hình trong system_prompt.json 
    # để yêu cầu trả về cấu trúc {"highlights": [...]}
    system_prompt_template = prompt_config.get(
        "system",
        "Bạn là chuyên gia ngôn ngữ học thuật. Nhiệm vụ của bạn là trích xuất và giải thích tối đa 3 thuật ngữ cốt lõi trong văn bản cho trình độ {english_level}."
    )
    system_prompt = system_prompt_template.format(english_level=mapped_level)

    user_prompt_template = prompt_config.get("user", "Văn bản cần xử lý:\n\"{context}\"")
    user_prompt = user_prompt_template.format(context=text)

    async with extract_sem:
        for attempt in range(4):
            try:
                response = await llm_client.chat.completions.create(
                    model=OPENAI_MODEL,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.1,
                    max_tokens=1500, # Tăng max_tokens vì kết quả bao gồm cả giải thích
                )
                content = response.choices[0].message.content
                data = json.loads(content)
                
                # Trả về key "highlights" (chứa list các dict giải thích)
                return data.get("highlights", [])
                
            except Exception as e:
                print(f"NLP Extraction & Explanation Error (Attempt {attempt+1}): {e}")
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

def sanitize_text(text: str) -> str:
    """Làm sạch văn bản để tạo cache key đồng nhất."""
    text = text.lower()
    text = re.sub(r"^[^\w]+|[^\w]+$", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def generate_cache_key(context: str, word: str, english_level: str = "cơ bản") -> str:
    """Tạo key lưu trữ kết quả giải thích của một từ cụ thể trong ngữ cảnh."""
    clean_context = sanitize_text(context)
    prompt_version = get_prompt_cache_version()
    raw_key = f"{prompt_version}||{clean_context}||{word}||{english_level}"
    return hashlib.md5(raw_key.encode()).hexdigest()

def generate_extract_cache_key(context: str, english_level: str = "cơ bản") -> str:
    """Tạo key lưu trữ kết quả của quá trình quét (scan) toàn bộ đoạn văn bản."""
    clean_context = sanitize_text(context)
    prompt_version = get_prompt_cache_version()
    raw_key = f"{prompt_version}||EXTRACT_FULL||{clean_context}||{english_level}"
    return hashlib.md5(raw_key.encode()).hexdigest()