from typing import List, Optional, Dict, Any
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from sqlalchemy.orm import selectinload

from models.document import Document
from models.case import Case
from services.ollama_service import ollama_service
from schemas.document import DocumentSearchResult, DocumentResponse

logger = structlog.get_logger(__name__)


class DocumentService:
    def __init__(self):
        pass

    async def create_document(
        self, 
        db: AsyncSession,
        case_id: str,
        filename: str,
        content: str,
        metadata: Dict[str, Any],
        user_id: str
    ) -> Document:
        """Create a new document with embeddings."""
        try:
            # Generate embeddings
            embedding = await ollama_service.generate_embedding(content)
            
            # Create document
            document = Document(
                case_id=case_id,
                filename=filename,
                content=content,
                embedding=embedding,
                doc_metadata=metadata,
                uploaded_by=user_id
            )
            
            db.add(document)
            await db.flush()
            await db.refresh(document)
            
            logger.info("Document created successfully", 
                       document_id=str(document.id),
                       filename=filename)
            
            return document
            
        except Exception as e:
            logger.error("Failed to create document", error=str(e))
            raise Exception(f"Document creation failed: {str(e)}")

    async def get_document(self, db: AsyncSession, document_id: str) -> Optional[Document]:
        """Get a document by ID."""
        try:
            result = await db.execute(
                select(Document).where(Document.id == document_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error("Failed to get document", error=str(e))
            return None

    async def get_documents_by_case(
        self, 
        db: AsyncSession, 
        case_id: str,
        skip: int = 0,
        limit: int = 50
    ) -> List[Document]:
        """Get all documents for a case."""
        try:
            result = await db.execute(
                select(Document)
                .where(Document.case_id == case_id)
                .order_by(Document.uploaded_at.desc())
                .offset(skip)
                .limit(limit)
            )
            return result.scalars().all()
        except Exception as e:
            logger.error("Failed to get documents by case", error=str(e))
            return []

    async def vector_search(
        self,
        db: AsyncSession,
        query: str,
        case_id: Optional[str] = None,
        limit: int = 10,
        threshold: float = 0.7
    ) -> List[DocumentSearchResult]:
        """Perform vector similarity search on documents."""
        try:
            # Generate embedding for query
            query_embedding = await ollama_service.generate_embedding(query)
            
            # Build SQL query for vector similarity search
            base_query = """
                SELECT 
                    d.id,
                    d.case_id,
                    d.filename,
                    d.content,
                    d.metadata as doc_metadata,
                    d.uploaded_at,
                    d.uploaded_by,
                    (d.embedding <=> :query_embedding) as distance,
                    (1 - (d.embedding <=> :query_embedding)) as similarity
                FROM documents d
                WHERE (1 - (d.embedding <=> :query_embedding)) >= :threshold
            """
            
            params = {
                "query_embedding": query_embedding,
                "threshold": threshold
            }
            
            if case_id:
                base_query += " AND d.case_id = :case_id"
                params["case_id"] = case_id
            
            base_query += " ORDER BY similarity DESC LIMIT :limit"
            params["limit"] = limit
            
            result = await db.execute(text(base_query), params)
            rows = result.fetchall()
            
            search_results = []
            for row in rows:
                # Create DocumentResponse
                doc_response = DocumentResponse(
                    id=row.id,
                    case_id=row.case_id,
                    filename=row.filename,
                    content=row.content,
                    metadata=row.doc_metadata,
                    uploaded_at=row.uploaded_at,
                    uploaded_by=row.uploaded_by
                )
                
                # Extract relevant excerpt (first 200 chars of content)
                excerpt = row.content[:200] + "..." if len(row.content) > 200 else row.content
                
                search_result = DocumentSearchResult(
                    document=doc_response,
                    similarity_score=float(row.similarity),
                    relevant_excerpt=excerpt
                )
                search_results.append(search_result)
            
            logger.info("Vector search completed", 
                       query=query,
                       results_count=len(search_results))
            
            return search_results
            
        except Exception as e:
            logger.error("Vector search failed", error=str(e))
            raise Exception(f"Vector search failed: {str(e)}")

    async def get_context_for_chat(
        self,
        db: AsyncSession,
        query: str,
        case_id: Optional[str] = None,
        max_context_length: int = 2000
    ) -> str:
        """Get relevant document context for chat."""
        try:
            # Search for relevant documents
            search_results = await self.vector_search(
                db=db,
                query=query,
                case_id=case_id,
                limit=5,
                threshold=0.6
            )
            
            if not search_results:
                return ""
            
            # Build context from search results
            context_parts = []
            current_length = 0
            
            for result in search_results:
                if current_length >= max_context_length:
                    break
                
                # Add document excerpt
                excerpt = result.relevant_excerpt or ""
                if len(excerpt) + current_length <= max_context_length:
                    context_parts.append(f"From {result.document.filename}: {excerpt}")
                    current_length += len(excerpt)
                else:
                    # Add partial excerpt to fit within limit
                    remaining = max_context_length - current_length
                    if remaining > 50:  # Only add if meaningful amount of text can be added
                        partial_excerpt = excerpt[:remaining-3] + "..."
                        context_parts.append(f"From {result.document.filename}: {partial_excerpt}")
                    break
            
            context = "\n\n".join(context_parts)
            logger.info("Context generated for chat", 
                       context_length=len(context),
                       documents_used=len(context_parts))
            
            return context
            
        except Exception as e:
            logger.error("Failed to get context for chat", error=str(e))
            return ""

    async def delete_document(self, db: AsyncSession, document_id: str) -> bool:
        """Delete a document."""
        try:
            document = await self.get_document(db, document_id)
            if not document:
                return False
            
            await db.delete(document)
            await db.flush()
            
            logger.info("Document deleted successfully", document_id=document_id)
            return True
            
        except Exception as e:
            logger.error("Failed to delete document", error=str(e))
            return False


# Global service instance
document_service = DocumentService()