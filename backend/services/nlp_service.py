import re
import hashlib
import json
from services.llm_service import llm_client, PROMPTS, ENGLISH_LEVEL_MAP

import asyncio

extract_sem = asyncio.Semaphore(3)

async def extract_keywords_llm(text: str, english_level: str) -> list[str]:
    prompt_config = PROMPTS.get("terminology_extraction", {})
    mapped_level = ENGLISH_LEVEL_MAP.get(english_level, english_level)
    
    system_prompt = prompt_config.get("system", "Bạn là một chuyên gia ngôn ngữ học. Nhiệm vụ của bạn là trích xuất các thuật ngữ (terminology) trong đoạn văn bản có độ khó cao hơn trình độ {english_level}. Lưu ý: Hãy phân tích nghĩa của từ theo ngữ cảnh (ví dụ: 'interest' trong tài chính khác với 'interest' thông thường). Trình độ của người dùng dựa trên khung CEFR.\nYÊU CẦU ĐẦU RA (Trả về JSON nghiêm ngặt):\n{{\n    \"terms\": [\"term1\", \"term2\"]\n}}")
    system_prompt = system_prompt.format(english_level=mapped_level)
    
    user_prompt = prompt_config.get("user", "Văn bản cần trích xuất:\n\"{context}\"")
    user_prompt = user_prompt.format(context=text)
    
    async with extract_sem:
        for attempt in range(4):
            try:
                response = await llm_client.chat.completions.create(
                    model="gpt-4o-mini",
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=1000
                )
                content = response.choices[0].message.content
                data = json.loads(content)
                return data.get("terms", [])
            except Exception as e:
                print(f"NLP Extraction Error (Attempt {attempt+1}): {e}")
                if "429" in str(e) and attempt < 3:
                    import re
                    wait_time = 2 ** attempt
                    match = re.search(r'try again in (\d+(?:\.\d+)?)(ms|s)', str(e))
                    if match:
                        val = float(match.group(1))
                        if match.group(2) == 'ms':
                            val /= 1000.0
                        wait_time = val + 0.5
                    await asyncio.sleep(wait_time)
                    continue
                return []
        return []

def sanitize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'^[^\w]+|[^\w]+$', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def generate_cache_key(context: str, word: str, english_level: str = "cơ bản") -> str:
    clean_context = sanitize_text(context)
    raw_key = f"{clean_context}||{word}||{english_level}"
    return hashlib.md5(raw_key.encode()).hexdigest()

def generate_extract_cache_key(context: str, english_level: str = "cơ bản") -> str:
    clean_context = sanitize_text(context)
    raw_key = f"EXTRACT||{clean_context}||{english_level}"
    return hashlib.md5(raw_key.encode()).hexdigest()