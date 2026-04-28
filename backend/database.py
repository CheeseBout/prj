from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date
from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import datetime
import uuid
from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    user_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    dob = Column(Date, nullable=True)
    gender = Column(Boolean, nullable=True)
    avatar = Column(String(255), nullable=True)
    major = Column(String(255), nullable=True)
    english_level = Column(String(50), nullable=True)
    role = Column(String(50), default="user", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Vocabulary(Base):
    __tablename__ = "vocabularies"
    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(255), unique=True, index=True)

class UserVocabProgress(Base):
    __tablename__ = "user_vocab_progress"
    user_id = Column(String(36), ForeignKey("users.user_id"), primary_key=True)
    vocab_id = Column(Integer, ForeignKey("vocabularies.id"), primary_key=True)
    status = Column(String(50), default="unseen") 
    specialization = Column(String(100), nullable=True)
    difficulty = Column(String(50), nullable=True)
    ease_factor = Column(Float, default=2.5)
    interval_days = Column(Integer, default=0)
    repetitions = Column(Integer, default=0)
    next_review_date = Column(DateTime, default=datetime.datetime.utcnow)
    context = Column(String(1000), nullable=True)
    translation = Column(String(1000), nullable=True)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Hàm Dependency dùng để inject Database session vào API
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
