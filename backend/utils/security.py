import jwt
import base64
import hashlib
from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from database import User, get_db

BCRYPT_SHA256_PREFIX = "bcrypt_sha256$"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    plain_password_bytes = plain_password.encode("utf-8")

    try:
        if hashed_password.startswith(BCRYPT_SHA256_PREFIX):
            # New format: SHA-256 + bcrypt to avoid bcrypt's 72-byte input limit.
            stored_hash = hashed_password[len(BCRYPT_SHA256_PREFIX) :].encode("utf-8")
            digest = hashlib.sha256(plain_password_bytes).digest()
            candidate = base64.b64encode(digest)
            return bcrypt.checkpw(candidate, stored_hash)

        if hashed_password.startswith("$2"):
            # Legacy bcrypt hashes may have been created with implicit truncation.
            candidate = plain_password_bytes[:72]
            return bcrypt.checkpw(candidate, hashed_password.encode("utf-8"))

        return False
    except ValueError as exc:
        # Treat malformed hash / invalid bcrypt input as non-match.
        if "Invalid salt" in str(exc) or "72 bytes" in str(exc):
            return False
        return False


def get_password_hash(password: str) -> str:
    password_bytes = password.encode("utf-8")
    digest = hashlib.sha256(password_bytes).digest()
    normalized = base64.b64encode(digest)
    bcrypt_hash = bcrypt.hashpw(normalized, bcrypt.gensalt()).decode("utf-8")
    return f"{BCRYPT_SHA256_PREFIX}{bcrypt_hash}"


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "token_type": "access"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire, "token_type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def extract_token_from_auth_header(auth_header: str | None) -> str | None:
    if not auth_header:
        return None
    normalized = auth_header.strip().strip('"')
    if normalized.startswith("Bearer "):
        return normalized.replace("Bearer ", "", 1)
    return None


def extract_bearer_token(raw_token: str | None) -> str | None:
    if not raw_token:
        return None
    normalized = raw_token.strip().strip('"')
    if normalized.startswith("Bearer "):
        return normalized.replace("Bearer ", "", 1)
    return normalized


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    token = extract_token_from_auth_header(request.headers.get("Authorization"))

    if not token:
        token = extract_bearer_token(request.cookies.get("access_token"))

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        token_type = payload.get("token_type")
        if token_type == "refresh":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalars().first()

    if user is None:
        raise credentials_exception

    return user
