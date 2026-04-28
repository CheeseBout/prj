import redis.asyncio as redis
from config import REDIS_URL

redis_client = redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None

class CacheState:
    is_available = redis_client is not None

cache_state = CacheState()