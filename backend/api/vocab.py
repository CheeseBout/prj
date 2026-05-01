import random
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from typing import List, Optional
import datetime

from database import (
    Collection,
    CollectionWord,
    Tag,
    User,
    UserVocabProgress,
    VocabTag,
    Vocabulary,
    get_db,
)
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
    
    collection_stats_query = (
        select(
            func.count(func.distinct(Collection.id)).label("total_collections"),
            func.count(func.distinct(CollectionWord.vocab_id)).label("words_in_collections"),
        )
        .select_from(Collection)
        .outerjoin(
            CollectionWord,
            (CollectionWord.collection_id == Collection.id)
            & (CollectionWord.user_id == Collection.user_id),
        )
        .where(Collection.user_id == current_user.user_id)
    )
    collection_stats_res = await db.execute(collection_stats_query)
    collection_stats = collection_stats_res.one()

    return {
        "status": "success",
        "data": {
            "total_words": total_words,
            "learning": status_counts.get("learning", 0),
            "mastered": status_counts.get("mastered", 0),
            "unseen": status_counts.get("unseen", 0),
            "streak": streak,
            "total_collections": collection_stats.total_collections or 0,
            "words_in_collections": collection_stats.words_in_collections or 0,
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
    tags: List[str] = Query(None),
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
        
    if tags:
        query = query.join(
            VocabTag,
            (VocabTag.vocab_id == UserVocabProgress.vocab_id) & (VocabTag.user_id == UserVocabProgress.user_id)
        ).join(
            Tag, Tag.id == VocabTag.tag_id
        ).where(Tag.name.in_(tags))
        
    # Tính tổng
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0
    
    # Phân trang
    query = query.order_by(UserVocabProgress.next_review_date.desc()).offset(offset).limit(limit)
    res = await db.execute(query)
    
    rows = list(res)

    # Lấy tags
    words = [r.word for r in rows]
    tags_map: dict[str, list[str]] = {}
    if words:
        tags_q = (
            select(Vocabulary.word, Tag.name)
            .join(VocabTag, VocabTag.vocab_id == Vocabulary.id)
            .join(Tag, Tag.id == VocabTag.tag_id)
            .where(
                VocabTag.user_id == current_user.user_id,
                Vocabulary.word.in_(words)
            )
        )
        tags_res = await db.execute(tags_q)
        for tr in tags_res:
            tags_map.setdefault(tr.word, []).append(tr.name)
            
    items = []
    for row in rows:
        items.append({
            "word": row.word,
            "status": row.status,
            "specialization": row.specialization,
            "difficulty": row.difficulty,
            "context": row.context,
            "translation": row.translation,
            "next_review_date": row.next_review_date.isoformat() if row.next_review_date else None,
            "tags": tags_map.get(row.word, [])
        })
        
    return {
        "status": "success",
        "data": items,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/practice/specializations")
async def get_practice_specializations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trả về danh sách chuyên ngành + số từ đến hạn ôn tập cho mỗi chuyên ngành."""
    now = datetime.datetime.utcnow()

    query = select(
        UserVocabProgress.specialization,
        func.count(UserVocabProgress.vocab_id).label("due_count"),
    ).where(
        UserVocabProgress.user_id == current_user.user_id,
        UserVocabProgress.next_review_date <= now,
        UserVocabProgress.specialization.isnot(None),
    ).group_by(UserVocabProgress.specialization)

    res = await db.execute(query)

    items = []
    total_due = 0
    for row in res:
        items.append({
            "specialization": row.specialization,
            "due_count": row.due_count,
        })
        total_due += row.due_count

    return {"status": "success", "total_due": total_due, "data": items}


@router.get("/practice")
async def get_practice_list(
    specialization: Optional[str] = None,
    tag: Optional[str] = None,
    collection_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    now = datetime.datetime.utcnow()
    query = select(
        Vocabulary.word,
        Vocabulary.id.label("vid"),
        UserVocabProgress.context,
        UserVocabProgress.translation,
        UserVocabProgress.en_explanation,
        UserVocabProgress.vi_explanation,
        UserVocabProgress.specialization,
        UserVocabProgress.difficulty,
        UserVocabProgress.status,
        UserVocabProgress.next_review_date,
    ).join(
        Vocabulary, UserVocabProgress.vocab_id == Vocabulary.id
    ).where(
        UserVocabProgress.user_id == current_user.user_id,
        UserVocabProgress.next_review_date <= now,
    )

    if specialization and specialization != "all":
        query = query.where(UserVocabProgress.specialization == specialization)

    if tag:
        query = query.join(
            VocabTag,
            (VocabTag.vocab_id == UserVocabProgress.vocab_id) & (VocabTag.user_id == UserVocabProgress.user_id)
        ).join(
            Tag, Tag.id == VocabTag.tag_id
        ).where(Tag.name == tag.strip().lower())

    if collection_id is not None:
        collection_check = await db.execute(
            select(Collection.id).where(
                Collection.id == collection_id,
                Collection.user_id == current_user.user_id,
            )
        )
        if not collection_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Collection not found")

        query = query.join(
            CollectionWord,
            (CollectionWord.vocab_id == UserVocabProgress.vocab_id)
            & (CollectionWord.user_id == UserVocabProgress.user_id),
        ).where(CollectionWord.collection_id == collection_id)

    query = query.order_by(UserVocabProgress.next_review_date.asc()).limit(30)
    
    res = await db.execute(query)
    rows = list(res)

    # Lấy tags cho tất cả các từ trong kết quả
    vocab_ids = [r.vid for r in rows]
    tags_map: dict[int, list[dict]] = {}
    if vocab_ids:
        tags_q = (
            select(VocabTag.vocab_id, Tag.id, Tag.name, Tag.color)
            .join(Tag, Tag.id == VocabTag.tag_id)
            .where(VocabTag.user_id == current_user.user_id, VocabTag.vocab_id.in_(vocab_ids))
        )
        tags_res = await db.execute(tags_q)
        for tr in tags_res:
            tags_map.setdefault(tr.vocab_id, []).append(tr.name)

    items = []
    for row in rows:
        items.append({
            "word": row.word,
            "context": row.context,
            "translation": row.translation,
            "en_explanation": row.en_explanation,
            "vi_explanation": row.vi_explanation,
            "specialization": row.specialization,
            "difficulty": row.difficulty,
            "status": row.status,
            "next_review_date": row.next_review_date.isoformat() if row.next_review_date else None,
            "tags": tags_map.get(row.vid, []),
        })
        
    return {
        "status": "success",
        "data": items
    }


@router.get("/quiz")
async def get_quiz(
    specialization: Optional[str] = None,
    tag: Optional[str] = None,
    collection_id: Optional[int] = None,
    count: int = 10,
    quiz_type: str = "en_to_vi",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tạo bộ câu hỏi quiz trắc nghiệm từ các từ đến hạn ôn tập.
    quiz_type: 'en_to_vi' (cho từ EN → chọn dịch VI) hoặc 'vi_to_en' (cho nghĩa VI → chọn từ EN)
    """
    now = datetime.datetime.utcnow()

    # 1) Lấy các từ đến hạn ôn tập
    due_query = select(
        Vocabulary.word,
        UserVocabProgress.context,
        UserVocabProgress.translation,
        UserVocabProgress.en_explanation,
        UserVocabProgress.vi_explanation,
        UserVocabProgress.specialization,
        UserVocabProgress.difficulty,
    ).join(
        Vocabulary, UserVocabProgress.vocab_id == Vocabulary.id
    ).where(
        UserVocabProgress.user_id == current_user.user_id,
        UserVocabProgress.next_review_date <= now,
        UserVocabProgress.translation.isnot(None),
    )

    if specialization and specialization != "all":
        due_query = due_query.where(UserVocabProgress.specialization == specialization)

    if tag:
        due_query = due_query.join(
            VocabTag,
            (VocabTag.vocab_id == UserVocabProgress.vocab_id)
            & (VocabTag.user_id == UserVocabProgress.user_id),
        ).join(
            Tag, Tag.id == VocabTag.tag_id
        ).where(Tag.name == tag.strip().lower())

    if collection_id is not None:
        collection_check = await db.execute(
            select(Collection.id).where(
                Collection.id == collection_id,
                Collection.user_id == current_user.user_id,
            )
        )
        if not collection_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Collection not found")

        due_query = due_query.join(
            CollectionWord,
            (CollectionWord.vocab_id == UserVocabProgress.vocab_id)
            & (CollectionWord.user_id == UserVocabProgress.user_id),
        ).where(CollectionWord.collection_id == collection_id)

    due_result = await db.execute(due_query)
    due_rows = [dict(row._mapping) for row in due_result]
    random.shuffle(due_rows)
    due_rows = due_rows[:count]

    if not due_rows:
        return {"status": "success", "data": []}

    # 2) Lấy tất cả từ của user (để làm đáp án nhiễu)
    all_query = select(
        Vocabulary.word,
        UserVocabProgress.translation,
    ).join(
        Vocabulary, UserVocabProgress.vocab_id == Vocabulary.id
    ).where(
        UserVocabProgress.user_id == current_user.user_id,
        UserVocabProgress.translation.isnot(None),
    )
    all_result = await db.execute(all_query)
    all_pairs = [(r.word, r.translation) for r in all_result]

    # 3) Tạo câu hỏi
    questions = []
    for dw in due_rows:
        word = dw["word"]
        translation = dw["translation"]
        if not translation:
            continue

        if quiz_type == "en_to_vi":
            correct = translation
            pool = [t for w, t in all_pairs if w != word and t and t != translation]
        else:
            correct = word
            pool = [w for w, t in all_pairs if w != word]

        if len(pool) < 3:
            continue

        distractors = random.sample(pool, 3)
        choices = distractors + [correct]
        random.shuffle(choices)

        questions.append({
            "word": word,
            "context": dw.get("context"),
            "translation": translation,
            "en_explanation": dw.get("en_explanation"),
            "vi_explanation": dw.get("vi_explanation"),
            "specialization": dw.get("specialization"),
            "difficulty": dw.get("difficulty"),
            "correct_answer": correct,
            "choices": choices,
            "correct_index": choices.index(correct),
            "quiz_type": quiz_type,
        })

    return {"status": "success", "data": questions}
