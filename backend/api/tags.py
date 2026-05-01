from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete

from database import get_db, Tag, VocabTag, Vocabulary, UserVocabProgress, User
from utils.security import get_current_user

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None

class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class TagAssign(BaseModel):
    tag_ids: List[int]

class SpecOverride(BaseModel):
    specialization: str

class TagSync(BaseModel):
    tags: List[str]

# ── Tag CRUD ─────────────────────────────────────────────────────

@router.get("")
async def get_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy tất cả tags của user, kèm số lượng từ được gắn tag."""
    # Lấy danh sách tags và số lượng từ
    query = (
        select(Tag.id, Tag.name, Tag.color, func.count(VocabTag.vocab_id).label("word_count"))
        .outerjoin(VocabTag, (VocabTag.tag_id == Tag.id) & (VocabTag.user_id == Tag.user_id))
        .where(Tag.user_id == current_user.user_id)
        .group_by(Tag.id, Tag.name, Tag.color)
        .order_by(Tag.name)
    )
    res = await db.execute(query)
    tags_data = [{"id": r.id, "name": r.name, "tag": r.name, "color": r.color, "word_count": r.word_count} for r in res]

    # Đếm số lượng từ đến hạn ôn tập cho mỗi tag
    from datetime import datetime
    now = datetime.utcnow()
    due_query = (
        select(VocabTag.tag_id, func.count(VocabTag.vocab_id).label("due_count"))
        .join(UserVocabProgress, (UserVocabProgress.vocab_id == VocabTag.vocab_id) & (UserVocabProgress.user_id == VocabTag.user_id))
        .where(
            VocabTag.user_id == current_user.user_id,
            UserVocabProgress.next_review_date <= now
        )
        .group_by(VocabTag.tag_id)
    )
    due_res = await db.execute(due_query)
    due_map = {r.tag_id: r.due_count for r in due_res}

    items = []
    for t in tags_data:
        t["due_count"] = due_map.get(t["id"], 0)
        items.append(t)
        
    return {"status": "success", "data": items}


@router.post("")
async def create_tag(
    data: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = data.name.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")

    # Check duplicate
    existing = await db.execute(
        select(Tag).where(Tag.user_id == current_user.user_id, Tag.name == name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tag already exists")

    tag = Tag(user_id=current_user.user_id, name=name, color=data.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return {"status": "success", "data": {"id": tag.id, "name": tag.name, "color": tag.color}}


@router.put("/{tag_id}")
async def update_tag(
    tag_id: int,
    data: TagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.user_id)
    )
    tag = res.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if data.name is not None:
        tag.name = data.name.strip().lower()
    if data.color is not None:
        tag.color = data.color

    await db.commit()
    return {"status": "success", "data": {"id": tag.id, "name": tag.name, "color": tag.color}}


@router.delete("/{tag_id}")
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.user_id)
    )
    tag = res.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Xóa tất cả vocab_tag associations trước
    await db.execute(
        delete(VocabTag).where(VocabTag.tag_id == tag_id, VocabTag.user_id == current_user.user_id)
    )
    await db.delete(tag)
    await db.commit()
    return {"status": "success"}


# ── Vocab ↔ Tag Assignment ───────────────────────────────────────

@router.get("/word/{word}")
async def get_word_tags(
    word: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy tags đang gắn cho 1 từ."""
    query = (
        select(Tag.id, Tag.name, Tag.color)
        .join(VocabTag, VocabTag.tag_id == Tag.id)
        .join(Vocabulary, Vocabulary.id == VocabTag.vocab_id)
        .where(
            VocabTag.user_id == current_user.user_id,
            Vocabulary.word == word,
        )
    )
    res = await db.execute(query)
    items = [{"id": r.id, "name": r.name, "color": r.color} for r in res]
    return {"status": "success", "data": items}


@router.post("/word/{word}")
async def assign_tags_to_word(
    word: str,
    data: TagAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gắn một hoặc nhiều tags cho 1 từ. Bỏ qua nếu đã gắn rồi."""
    vocab_res = await db.execute(select(Vocabulary).where(Vocabulary.word == word))
    vocab = vocab_res.scalar_one_or_none()
    if not vocab:
        raise HTTPException(status_code=404, detail="Word not found in vocabulary")

    added = 0
    for tag_id in data.tag_ids:
        # Kiểm tra tag thuộc user
        tag_res = await db.execute(
            select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.user_id)
        )
        if not tag_res.scalar_one_or_none():
            continue

        # Kiểm tra đã gắn chưa
        existing = await db.execute(
            select(VocabTag).where(
                VocabTag.user_id == current_user.user_id,
                VocabTag.vocab_id == vocab.id,
                VocabTag.tag_id == tag_id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        db.add(VocabTag(user_id=current_user.user_id, vocab_id=vocab.id, tag_id=tag_id))
        added += 1

    await db.commit()
    return {"status": "success", "added": added}


@router.delete("/word/{word}/{tag_id}")
async def remove_tag_from_word(
    word: str,
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vocab_res = await db.execute(select(Vocabulary).where(Vocabulary.word == word))
    vocab = vocab_res.scalar_one_or_none()
    if not vocab:
        raise HTTPException(status_code=404, detail="Word not found")

    await db.execute(
        delete(VocabTag).where(
            VocabTag.user_id == current_user.user_id,
            VocabTag.vocab_id == vocab.id,
            VocabTag.tag_id == tag_id,
        )
    )
    await db.commit()
    return {"status": "success"}


# ── Specialization Override ──────────────────────────────────────

@router.put("/word/{word}/specialization")
async def override_specialization(
    word: str,
    data: SpecOverride,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cho phép user override specialization do AI dự đoán."""
    vocab_res = await db.execute(select(Vocabulary).where(Vocabulary.word == word))
    vocab = vocab_res.scalar_one_or_none()
    if not vocab:
        raise HTTPException(status_code=404, detail="Word not found")

    progress_res = await db.execute(
        select(UserVocabProgress).where(
            UserVocabProgress.user_id == current_user.user_id,
            UserVocabProgress.vocab_id == vocab.id,
        )
    )
    progress = progress_res.scalar_one_or_none()
    if not progress:
        raise HTTPException(status_code=404, detail="Word not in your vocabulary")

    progress.specialization = data.specialization.strip()
    await db.commit()
    return {"status": "success", "specialization": progress.specialization}


@router.put("/word/{word}/tags/sync")
async def sync_tags_for_word(
    word: str,
    data: TagSync,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync list of string tags for a word (create missing tags, assign them, remove others)."""
    vocab_res = await db.execute(select(Vocabulary).where(Vocabulary.word == word))
    vocab = vocab_res.scalar_one_or_none()
    if not vocab:
        raise HTTPException(status_code=404, detail="Word not found in vocabulary")

    # Lowercase all input tags
    input_tags = list(set([t.strip().lower() for t in data.tags if t.strip()]))

    # Get existing tags for this user
    user_tags_res = await db.execute(select(Tag).where(Tag.user_id == current_user.user_id))
    user_tags = list(user_tags_res.scalars())
    tag_map = {t.name: t for t in user_tags}

    # Create missing tags
    tags_to_assign = []
    for t_name in input_tags:
        if t_name not in tag_map:
            new_tag = Tag(user_id=current_user.user_id, name=t_name)
            db.add(new_tag)
            tags_to_assign.append(new_tag)
        else:
            tags_to_assign.append(tag_map[t_name])
            
    await db.commit() # commit to get IDs for new tags
    
    # Refresh to ensure we have IDs
    for t in tags_to_assign:
        if not t.id:
            await db.refresh(t)

    target_tag_ids = {t.id for t in tags_to_assign}

    # Get current assignments
    current_assignments_res = await db.execute(
        select(VocabTag).where(
            VocabTag.user_id == current_user.user_id,
            VocabTag.vocab_id == vocab.id
        )
    )
    current_assignments = list(current_assignments_res.scalars())
    current_tag_ids = {vt.tag_id for vt in current_assignments}

    # Remove tags not in target
    to_remove = current_tag_ids - target_tag_ids
    if to_remove:
        await db.execute(
            delete(VocabTag).where(
                VocabTag.user_id == current_user.user_id,
                VocabTag.vocab_id == vocab.id,
                VocabTag.tag_id.in_(to_remove)
            )
        )

    # Add tags not in current
    to_add = target_tag_ids - current_tag_ids
    for tag_id in to_add:
        db.add(VocabTag(user_id=current_user.user_id, vocab_id=vocab.id, tag_id=tag_id))

    await db.commit()
    return {"status": "success", "tags": input_tags}
