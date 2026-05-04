import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from utils.logger import request_logging_middleware, append_json_log
from utils.cache import redis_client, cache_state
from api import scan, progress, auth, vocab, tags, collections, test

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init DB
    try:
        await init_db()
        await append_json_log({
            "event": "startup_init_db_success",
            "timestamp": datetime.datetime.now().isoformat(),
        })
    except Exception as e:
        await append_json_log({
            "event": "startup_init_db_failed",
            "timestamp": datetime.datetime.now().isoformat(),
            "error": str(e),
        })
        raise

    # Init Redis
    if redis_client is not None:
        try:
            await redis_client.ping()
            print("[Redis] Connected successfully")
            await append_json_log({
                "event": "startup_redis_connected",
                "timestamp": datetime.datetime.now().isoformat(),
            })
        except Exception as e:
            cache_state.is_available = False
            print(f"[Redis] Disabled: {e}")
            await append_json_log({
                "event": "startup_redis_disabled",
                "timestamp": datetime.datetime.now().isoformat(),
                "error": str(e),
            })

    yield

    if redis_client is not None:
        await redis_client.aclose()


app = FastAPI(title="Academic Language Assistant API", lifespan=lifespan)

# Middlewares
app.middleware("http")(request_logging_middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", # Frontend Next.js
        "http://127.0.0.1:3000",
        "chrome-extension://ebfeldnejjhgnpikgmajjacocnaofaol" # ID Extension
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(scan.router, prefix="/api", tags=["Scanner"])
app.include_router(progress.router, prefix="/api", tags=["Progress & Translation"])
app.include_router(vocab.router, prefix="/api/vocab", tags=["Vocab Management"])
app.include_router(tags.router, prefix="/api/tags", tags=["Tags"])
app.include_router(collections.router, prefix="/api/collections", tags=["Collections"])
app.include_router(test.router, prefix="/api/test", tags=["Test"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
