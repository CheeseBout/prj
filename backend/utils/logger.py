import json
import datetime
import asyncio
import os
from fastapi import Request

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(BASE_DIR, "log.json")
LOG_WRITE_LOCK = asyncio.Lock()

async def append_json_log(log_entry: dict) -> None:
    def _write_log_file() -> None:
        logs = []
        if os.path.exists(LOG_FILE):
            try:
                with open(LOG_FILE, "r", encoding="utf-8") as f:
                    parsed_data = json.load(f)
                    if isinstance(parsed_data, list):
                        logs = parsed_data
            except (json.JSONDecodeError, OSError):
                logs = []

        logs.append(log_entry)
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)

    async with LOG_WRITE_LOCK:
        await asyncio.to_thread(_write_log_file)

def _truncate_text(value: str, max_len: int = 2000) -> str:
    if len(value) <= max_len:
        return value
    return value[:max_len] + "...<truncated>"

def _safe_decode_body(body: bytes, max_len: int = 2000):
    if not body:
        return None
    try:
        text = body.decode("utf-8", errors="replace")
    except Exception:
        return "<unreadable-body>"
    text = _truncate_text(text, max_len=max_len)
    try:
        return json.loads(text)
    except Exception:
        return text

async def request_logging_middleware(request: Request, call_next):
    start = datetime.datetime.now()
    request_body = await request.body()
    error_message = None
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception as e:
        error_message = str(e)
        raise
    finally:
        duration_ms = int((datetime.datetime.now() - start).total_seconds() * 1000)
        log_entry = {
            "event": "http_request",
            "timestamp": datetime.datetime.now().isoformat(),
            "method": request.method,
            "path": request.url.path,
            "query": dict(request.query_params),
            "status_code": status_code,
            "duration_ms": duration_ms,
            "request_body": _safe_decode_body(request_body),
        }
        if error_message:
            log_entry["error"] = error_message
        await append_json_log(log_entry)
    return response