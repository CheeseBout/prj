from pydantic import BaseModel, EmailStr
from typing import List, Optional
from enum import Enum
from datetime import date, datetime

class RoleEnum(str, Enum):
    ADMIN = "admin"
    USER = "user"

class ScanElement(BaseModel):
    element_id: str
    text_context: str
    html_context: Optional[str] = None 

class ScanPayload(BaseModel):
    url: Optional[str] = None
    elements: List[ScanElement] = []
    text: Optional[str] = None
    english_level: Optional[str] = "cơ bản"

class ProgressUpdate(BaseModel):
    word: str
    quality: int
    context: Optional[str] = None
    translation: Optional[str] = None

class ManualTranslateRequest(BaseModel):
    word: str
    context: str
    english_level: Optional[str] = "cơ bản"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    dob: Optional[date] = None
    gender: Optional[bool] = None
    avatar: Optional[str] = None
    major: Optional[str] = None
    english_level: Optional[str] = None
    role: RoleEnum = RoleEnum.USER

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[bool] = None
    avatar: Optional[str] = None
    major: Optional[str] = None
    english_level: Optional[str] = None
    role: Optional[RoleEnum] = None

class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    dob: Optional[date]
    gender: Optional[bool]
    avatar: Optional[str]
    major: Optional[str]
    english_level: Optional[str]
    created_at: datetime
    updated_at: datetime
    role: RoleEnum
    
    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"