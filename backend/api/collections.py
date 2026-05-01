import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import (
    Collection,
    CollectionWord,
    User,
    UserVocabProgress,
    Vocabulary,
    get_db,
)
from utils.security import get_current_user

router = APIRouter()


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CollectionWordsAdd(BaseModel):
    words: List[str]


async def _get_collection_or_404(
    db: AsyncSession, user_id: str, collection_id: int
) -> Collection:
    result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == user_id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection


def _normalize_word(word: str) -> str:
    return word.strip().lower()


@router.get("")
async def get_collections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(
            Collection.id,
            Collection.name,
            Collection.description,
            Collection.created_at,
            func.count(CollectionWord.vocab_id).label("word_count"),
        )
        .outerjoin(
            CollectionWord,
            (CollectionWord.collection_id == Collection.id)
            & (CollectionWord.user_id == Collection.user_id),
        )
        .where(Collection.user_id == current_user.user_id)
        .group_by(
            Collection.id,
            Collection.name,
            Collection.description,
            Collection.created_at,
        )
        .order_by(Collection.created_at.desc(), Collection.id.desc())
    )
    res = await db.execute(query)
    items = [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "word_count": r.word_count,
        }
        for r in res
    ]
    return {"status": "success", "data": items}


@router.post("")
async def create_collection(
    data: CollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Collection name cannot be empty")

    duplicate = await db.execute(
        select(Collection).where(
            Collection.user_id == current_user.user_id,
            func.lower(Collection.name) == name.lower(),
        )
    )
    if duplicate.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Collection already exists")

    collection = Collection(
        user_id=current_user.user_id,
        name=name,
        description=data.description.strip() if data.description else None,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    return {
        "status": "success",
        "data": {
            "id": collection.id,
            "name": collection.name,
            "description": collection.description,
            "created_at": collection.created_at.isoformat() if collection.created_at else None,
            "word_count": 0,
        },
    }


@router.put("/{collection_id}")
async def update_collection(
    collection_id: int,
    data: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = await _get_collection_or_404(db, current_user.user_id, collection_id)

    if data.name is not None:
        new_name = data.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Collection name cannot be empty")
        duplicate = await db.execute(
            select(Collection).where(
                Collection.user_id == current_user.user_id,
                Collection.id != collection_id,
                func.lower(Collection.name) == new_name.lower(),
            )
        )
        if duplicate.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Collection already exists")
        collection.name = new_name

    if data.description is not None:
        collection.description = data.description.strip() or None

    await db.commit()
    return {
        "status": "success",
        "data": {
            "id": collection.id,
            "name": collection.name,
            "description": collection.description,
            "created_at": collection.created_at.isoformat() if collection.created_at else None,
        },
    }


@router.delete("/{collection_id}")
async def delete_collection(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = await _get_collection_or_404(db, current_user.user_id, collection_id)

    await db.execute(
        delete(CollectionWord).where(
            CollectionWord.collection_id == collection.id,
            CollectionWord.user_id == current_user.user_id,
        )
    )
    await db.delete(collection)
    await db.commit()
    return {"status": "success"}


@router.post("/{collection_id}/words")
async def add_words_to_collection(
    collection_id: int,
    data: CollectionWordsAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_collection_or_404(db, current_user.user_id, collection_id)

    normalized_words = []
    seen = set()
    for word in data.words:
        normalized = _normalize_word(word)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        normalized_words.append(normalized)

    if not normalized_words:
        raise HTTPException(status_code=400, detail="No valid words provided")

    vocab_query = (
        select(func.lower(Vocabulary.word).label("normalized_word"), Vocabulary.id)
        .join(UserVocabProgress, UserVocabProgress.vocab_id == Vocabulary.id)
        .where(
            UserVocabProgress.user_id == current_user.user_id,
            func.lower(Vocabulary.word).in_(normalized_words),
        )
    )
    vocab_result = await db.execute(vocab_query)
    vocab_map = {row.normalized_word: row.id for row in vocab_result}

    found_vocab_ids = list(vocab_map.values())
    existing_ids = set()
    if found_vocab_ids:
        existing_result = await db.execute(
            select(CollectionWord.vocab_id).where(
                CollectionWord.collection_id == collection_id,
                CollectionWord.user_id == current_user.user_id,
                CollectionWord.vocab_id.in_(found_vocab_ids),
            )
        )
        existing_ids = {row.vocab_id for row in existing_result}

    added = 0
    skipped_existing = []
    skipped_missing = []

    for normalized_word in normalized_words:
        vocab_id = vocab_map.get(normalized_word)
        if not vocab_id:
            skipped_missing.append(normalized_word)
            continue
        if vocab_id in existing_ids:
            skipped_existing.append(normalized_word)
            continue

        db.add(
            CollectionWord(
                collection_id=collection_id,
                user_id=current_user.user_id,
                vocab_id=vocab_id,
            )
        )
        added += 1

    await db.commit()
    return {
        "status": "success",
        "added": added,
        "skipped_existing": skipped_existing,
        "skipped_missing": skipped_missing,
    }


@router.delete("/{collection_id}/words/{word}")
async def remove_word_from_collection(
    collection_id: int,
    word: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_collection_or_404(db, current_user.user_id, collection_id)

    normalized_word = _normalize_word(word)
    vocab_result = await db.execute(
        select(Vocabulary.id).where(func.lower(Vocabulary.word) == normalized_word)
    )
    vocab_id = vocab_result.scalar_one_or_none()
    if not vocab_id:
        raise HTTPException(status_code=404, detail="Word not found")

    await db.execute(
        delete(CollectionWord).where(
            CollectionWord.collection_id == collection_id,
            CollectionWord.user_id == current_user.user_id,
            CollectionWord.vocab_id == vocab_id,
        )
    )
    await db.commit()
    return {"status": "success"}


@router.get("/{collection_id}/words")
async def get_collection_words(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = await _get_collection_or_404(db, current_user.user_id, collection_id)

    query = (
        select(
            Vocabulary.word,
            UserVocabProgress.status,
            UserVocabProgress.specialization,
            UserVocabProgress.difficulty,
            UserVocabProgress.context,
            UserVocabProgress.translation,
            UserVocabProgress.next_review_date,
        )
        .join(CollectionWord, CollectionWord.vocab_id == Vocabulary.id)
        .join(
            UserVocabProgress,
            (UserVocabProgress.vocab_id == Vocabulary.id)
            & (UserVocabProgress.user_id == CollectionWord.user_id),
        )
        .where(
            CollectionWord.collection_id == collection_id,
            CollectionWord.user_id == current_user.user_id,
        )
        .order_by(Vocabulary.word.asc())
    )
    res = await db.execute(query)
    items = [
        {
            "word": r.word,
            "status": r.status,
            "specialization": r.specialization,
            "difficulty": r.difficulty,
            "context": r.context,
            "translation": r.translation,
            "next_review_date": r.next_review_date.isoformat() if r.next_review_date else None,
        }
        for r in res
    ]
    return {
        "status": "success",
        "collection": {
            "id": collection.id,
            "name": collection.name,
            "description": collection.description,
            "created_at": collection.created_at.isoformat() if collection.created_at else None,
        },
        "data": items,
    }


@router.get("/stats/overview")
async def get_collection_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summary_query = (
        select(
            func.count(func.distinct(Collection.id)).label("total_collections"),
            func.count(func.distinct(CollectionWord.vocab_id)).label("unique_words_in_collections"),
        )
        .select_from(Collection)
        .outerjoin(
            CollectionWord,
            (CollectionWord.collection_id == Collection.id)
            & (CollectionWord.user_id == Collection.user_id),
        )
        .where(Collection.user_id == current_user.user_id)
    )
    summary_result = await db.execute(summary_query)
    summary_row = summary_result.one()

    by_collection_query = (
        select(
            Collection.id,
            Collection.name,
            func.count(CollectionWord.vocab_id).label("word_count"),
        )
        .outerjoin(
            CollectionWord,
            (CollectionWord.collection_id == Collection.id)
            & (CollectionWord.user_id == Collection.user_id),
        )
        .where(Collection.user_id == current_user.user_id)
        .group_by(Collection.id, Collection.name)
        .order_by(func.count(CollectionWord.vocab_id).desc(), Collection.name.asc())
    )
    by_collection_result = await db.execute(by_collection_query)
    by_collection = [
        {"id": row.id, "name": row.name, "word_count": row.word_count}
        for row in by_collection_result
    ]

    return {
        "status": "success",
        "data": {
            "total_collections": summary_row.total_collections or 0,
            "unique_words_in_collections": summary_row.unique_words_in_collections or 0,
            "collections": by_collection,
        },
    }
