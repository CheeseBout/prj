from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Date, UniqueConstraint, Text
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
    current_streak = Column(Integer, default=0)
    last_study_date = Column(Date, nullable=True)
    last_active_date = Column(Date, nullable=True)

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
    en_explanation = Column(String(2000), nullable=True)
    vi_explanation = Column(String(2000), nullable=True)

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=True)  # hex color e.g. "#3b82f6"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_tag_name"),
    )

class VocabTag(Base):
    __tablename__ = "vocab_tags"
    user_id = Column(String(36), ForeignKey("users.user_id"), primary_key=True)
    vocab_id = Column(Integer, ForeignKey("vocabularies.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)

class Collection(Base):
    __tablename__ = "collections"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_collection_name"),
    )

class CollectionWord(Base):
    __tablename__ = "collection_words"
    collection_id = Column(Integer, ForeignKey("collections.id"), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), primary_key=True)
    vocab_id = Column(Integer, ForeignKey("vocabularies.id"), primary_key=True)

class QuestionBank(Base):
    __tablename__ = "question_bank"
    id = Column(Integer, primary_key=True, index=True)
    vocab_id = Column(Integer, ForeignKey("vocabularies.id"), nullable=False, index=True)
    question_type = Column(String(50), nullable=False, default="meaning_mcq_en", index=True)
    stem = Column(String(1000), nullable=False)
    choices_json = Column(Text, nullable=False)
    correct_index = Column(Integer, nullable=False)
    explanation_en = Column(String(2000), nullable=True)
    specialization = Column(String(100), nullable=True)
    difficulty = Column(String(50), nullable=True)
    prompt_version = Column(String(100), nullable=False, default="mcq_en_v1", index=True)
    content_fingerprint = Column(String(64), nullable=False, index=True)
    language = Column(String(20), nullable=False, default="en")
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    __table_args__ = (
        UniqueConstraint(
            "vocab_id",
            "question_type",
            "content_fingerprint",
            "prompt_version",
            name="uq_question_bank_vocab_type_fingerprint_prompt",
        ),
    )

class UserQuestionAttempt(Base):
    __tablename__ = "user_question_attempt"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("question_bank.id"), nullable=False, index=True)
    selected_index = Column(Integer, nullable=True)
    is_correct = Column(Boolean, nullable=False)
    quality_score = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, nullable=True)
    answered_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Hàm Dependency dùng để inject Database session vào API
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
