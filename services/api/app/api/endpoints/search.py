"""
Vector search endpoints for semantic document search
"""

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
import numpy as np

from app.core.database import get_db
from app.models.document import Document, DocumentChunk
from app.models.case import Case
from app.services.embeddings import generate_query_embedding

router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str
    case_id: Optional[UUID] = None
    limit: int = 10
    threshold: float = 0.5


class SearchResult(BaseModel):
    chunk_id: UUID
    document_id: UUID
    document_name: str
    chunk_text: str
    similarity_score: float
    page_number: Optional[int]
    chunk_index: int


@router.post("/semantic", response_model=List[SearchResult])
async def semantic_search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Perform semantic search across document chunks
    Uses pgvector for efficient similarity search
    """
    
    # Generate query embedding
    query_embedding = await generate_query_embedding(request.query)
    
    # Build the similarity search query using pgvector
    # We'll use the <=> operator for cosine distance
    # Note: pgvector returns distance, so we convert to similarity
    
    if request.case_id:
        # Search within a specific case
        sql = text("""
            SELECT 
                dc.id as chunk_id,
                dc.document_id,
                d.filename as document_name,
                dc.text as chunk_text,
                dc.page_number,
                dc.chunk_index,
                1 - (dc.embedding <=> cast(:query_embedding as vector)) as similarity
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.case_id = :case_id
                AND dc.embedding IS NOT NULL
                AND 1 - (dc.embedding <=> cast(:query_embedding as vector)) > :threshold
            ORDER BY similarity DESC
            LIMIT :limit
        """)
        
        result = await db.execute(
            sql,
            {
                "query_embedding": str(query_embedding.tolist()),
                "case_id": request.case_id,
                "threshold": request.threshold,
                "limit": request.limit
            }
        )
    else:
        # Search across all documents
        sql = text("""
            SELECT 
                dc.id as chunk_id,
                dc.document_id,
                d.filename as document_name,
                dc.text as chunk_text,
                dc.page_number,
                dc.chunk_index,
                1 - (dc.embedding <=> cast(:query_embedding as vector)) as similarity
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE dc.embedding IS NOT NULL
                AND 1 - (dc.embedding <=> cast(:query_embedding as vector)) > :threshold
            ORDER BY similarity DESC
            LIMIT :limit
        """)
        
        result = await db.execute(
            sql,
            {
                "query_embedding": str(query_embedding.tolist()),
                "threshold": request.threshold,
                "limit": request.limit
            }
        )
    
    rows = result.fetchall()
    
    search_results = []
    for row in rows:
        search_results.append(SearchResult(
            chunk_id=row.chunk_id,
            document_id=row.document_id,
            document_name=row.document_name,
            chunk_text=row.chunk_text,
            similarity_score=row.similarity,
            page_number=row.page_number,
            chunk_index=row.chunk_index
        ))
    
    return search_results


@router.post("/hybrid")
async def hybrid_search(
    query: str,
    case_id: Optional[UUID] = None,
    keyword_weight: float = 0.3,
    semantic_weight: float = 0.7,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    Hybrid search combining keyword and semantic search
    """
    
    # Semantic search
    semantic_results = await semantic_search(
        SearchRequest(
            query=query,
            case_id=case_id,
            limit=limit * 2  # Get more results for reranking
        ),
        db
    )
    
    # Keyword search using PostgreSQL full-text search
    if case_id:
        keyword_sql = text("""
            SELECT 
                dc.id as chunk_id,
                dc.document_id,
                d.filename as document_name,
                dc.text as chunk_text,
                dc.page_number,
                dc.chunk_index,
                ts_rank(to_tsvector('english', dc.text), 
                       plainto_tsquery('english', :query)) as relevance
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.case_id = :case_id
                AND to_tsvector('english', dc.text) @@ 
                    plainto_tsquery('english', :query)
            ORDER BY relevance DESC
            LIMIT :limit
        """)
        
        keyword_result = await db.execute(
            keyword_sql,
            {"query": query, "case_id": case_id, "limit": limit * 2}
        )
    else:
        keyword_sql = text("""
            SELECT 
                dc.id as chunk_id,
                dc.document_id,
                d.filename as document_name,
                dc.text as chunk_text,
                dc.page_number,
                dc.chunk_index,
                ts_rank(to_tsvector('english', dc.text), 
                       plainto_tsquery('english', :query)) as relevance
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE to_tsvector('english', dc.text) @@ 
                  plainto_tsquery('english', :query)
            ORDER BY relevance DESC
            LIMIT :limit
        """)
        
        keyword_result = await db.execute(
            keyword_sql,
            {"query": query, "limit": limit * 2}
        )
    
    keyword_rows = keyword_result.fetchall()
    
    # Combine and rerank results
    combined_scores = {}
    
    # Add semantic results
    for result in semantic_results:
        combined_scores[result.chunk_id] = {
            "result": result,
            "score": result.similarity_score * semantic_weight
        }
    
    # Add keyword results
    max_relevance = max([row.relevance for row in keyword_rows], default=1.0)
    for row in keyword_rows:
        normalized_relevance = row.relevance / max_relevance if max_relevance > 0 else 0
        
        if row.chunk_id in combined_scores:
            # Combine scores
            combined_scores[row.chunk_id]["score"] += normalized_relevance * keyword_weight
        else:
            # Add new result
            combined_scores[row.chunk_id] = {
                "result": SearchResult(
                    chunk_id=row.chunk_id,
                    document_id=row.document_id,
                    document_name=row.document_name,
                    chunk_text=row.chunk_text,
                    similarity_score=0,  # No semantic score
                    page_number=row.page_number,
                    chunk_index=row.chunk_index
                ),
                "score": normalized_relevance * keyword_weight
            }
    
    # Sort by combined score
    sorted_results = sorted(
        combined_scores.values(),
        key=lambda x: x["score"],
        reverse=True
    )[:limit]
    
    return [
        {
            **item["result"].dict(),
            "combined_score": item["score"]
        }
        for item in sorted_results
    ]


@router.get("/stats/{case_id}")
async def get_search_stats(
    case_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get search statistics for a case"""
    
    # Check case exists
    case = await db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get document and chunk counts
    doc_count_result = await db.execute(
        select(Document).where(Document.case_id == case_id)
    )
    doc_count = len(doc_count_result.scalars().all())
    
    chunk_count_sql = text("""
        SELECT COUNT(dc.id) as chunk_count,
               COUNT(CASE WHEN dc.embedding IS NOT NULL THEN 1 END) as embedded_count
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE d.case_id = :case_id
    """)
    
    chunk_result = await db.execute(chunk_count_sql, {"case_id": case_id})
    chunk_stats = chunk_result.fetchone()
    
    return {
        "case_id": case_id,
        "document_count": doc_count,
        "total_chunks": chunk_stats.chunk_count,
        "embedded_chunks": chunk_stats.embedded_count,
        "indexing_complete": chunk_stats.chunk_count == chunk_stats.embedded_count
    }