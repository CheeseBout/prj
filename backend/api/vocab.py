from fastapi import APIRouter, Depends, Query
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from typing import List, Optional
import datetime

from database import get_db, Vocabulary, UserVocabProgress, User
from utils.security import get_current_user

router = APIRouter()

@router.get("/stats")
async def get_vocab_stats(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Đếm số lượng từ vựng theo trạng thái
    query = select(UserVocabProgress.status, func.count(UserVocabProgress.vocab_id)).where(
        UserVocabProgress.user_id == current_user.user_id
    ).group_by(UserVocabProgress.status)
    
    res = await db.execute(query)
    status_counts = {"learning": 0, "mastered": 0, "unseen": 0}
    for row in res:
        if row[0] in status_counts:
            status_counts[row[0]] = row[1]
        else:
            status_counts[row[0]] = row[1]
            
    # Tổng số từ đã tương tác
    total_words = sum(status_counts.values())
    
    # --- LOGIC LẤY STREAK ---
    today = datetime.datetime.utcnow().date()
    streak = current_user.current_streak or 0
    
    # Nếu lần cuối cùng học là trước ngày hôm qua (ví dụ: cách đây 2 ngày) 
    # và hôm nay chưa học, chuỗi hiện tại coi như bị đứt (trả về 0)
    if current_user.last_study_date and current_user.last_study_date < today - datetime.timedelta(days=1):
        streak = 0
    
    return {
        "status": "success",
        "data": {
            "total_words": total_words,
            "learning": status_counts.get("learning", 0),
            "mastered": status_counts.get("mastered", 0),
            "unseen": status_counts.get("unseen", 0),
            "streak": streak
        }
    }

@router.get("/list")
async def get_vocab_list(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None,
    specialization: Optional[str] = None,
    difficulty: Optional[str] = None,
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * limit
    
    query = select(
        Vocabulary.word,
        UserVocabProgress.status,
        UserVocabProgress.specialization,
        UserVocabProgress.difficulty,
        UserVocabProgress.context,
        UserVocabProgress.translation,
        UserVocabProgress.next_review_date
    ).join(
        Vocabulary, UserVocabProgress.vocab_id == Vocabulary.id
    ).where(
        UserVocabProgress.user_id == current_user.user_id
    )
    
    if search:
        query = query.where(Vocabulary.word.ilike(f"%{search}%"))
        
    if status and status != "all":
        query = query.where(UserVocabProgress.status == status)
    
    if specialization and specialization != "all":
        query = query.where(UserVocabProgress.specialization == specialization)

    if difficulty and difficulty != "all":
        query = query.where(UserVocabProgress.difficulty == difficulty)
        
    # Tính tổng
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0
    
    # Phân trang
    query = query.order_by(UserVocabProgress.next_review_date.desc()).offset(offset).limit(limit)
    res = await db.execute(query)
    
    items = []
    for row in res:
        items.append({
            "word": row.word,
            "status": row.status,
            "specialization": row.specialization,
            "difficulty": row.difficulty,
            "context": row.context,
            "translation": row.translation,
            "next_review_date": row.next_review_date.isoformat() if row.next_review_date else None
        })
        
    return {
        "status": "success",
        "data": items,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/practice")
async def get_practice_list(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    now = datetime.datetime.utcnow()
    query = select(
        Vocabulary.word,
        UserVocabProgress.context,
        UserVocabProgress.translation,
        UserVocabProgress.specialization,
        UserVocabProgress.difficulty,
        UserVocabProgress.status,
        UserVocabProgress.next_review_date,
    ).join(
        Vocabulary, UserVocabProgress.vocab_id == Vocabulary.id
    ).where(
        UserVocabProgress.user_id == current_user.user_id,
        UserVocabProgress.next_review_date <= now,
    ).order_by(UserVocabProgress.next_review_date.asc()).limit(30) 
    
    res = await db.execute(query)
    
    items = []
    for row in res:
        items.append({
            "word": row.word,
            "context": row.context,
            "translation": row.translation,
            "specialization": row.specialization,
            "difficulty": row.difficulty,
            "status": row.status,
            "next_review_date": row.next_review_date.isoformat() if row.next_review_date else None,
        })
        
    return {
        "status": "success",
        "data": items
    }
