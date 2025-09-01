#!/usr/bin/env python3
"""
Integration test for document processing pipeline with database

This tests the actual pipeline with database integration
"""

import asyncio
import os
import sys
import tempfile
import uuid
from datetime import datetime

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.document import Document, DocumentChunk
from app.models.case import Case
from app.models.user import User
from app.services.worker_tasks import process_document_pipeline
import structlog

# Configure logging
structlog.configure(
    processors=[
        structlog.dev.ConsoleRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


def create_test_text_file():
    """Create a simple text file for testing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as tmp:
        tmp.write("""SETTLEMENT AGREEMENT

Case Reference: Smith v Jones [2024] EWHC 123

This Settlement Agreement ("Agreement") is entered into on 1st January 2024
between John Smith ("Claimant") and Jane Jones ("Defendant").

RECITALS

WHEREAS, a dispute has arisen between the parties regarding breach of contract;

WHEREAS, the parties wish to resolve this matter without further litigation;

NOW, THEREFORE, in consideration of the mutual covenants contained herein,
the parties agree as follows:

1. PAYMENT TERMS
   The Defendant agrees to pay the Claimant the sum of £25,000 ("Settlement Amount")
   within thirty (30) days of execution of this Agreement.

2. RELEASE
   Upon receipt of the Settlement Amount, Claimant releases Defendant from
   all claims related to the underlying dispute.

3. CONFIDENTIALITY
   The parties agree to keep the terms of this Agreement confidential.

4. GOVERNING LAW
   This Agreement shall be governed by the laws of England and Wales.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date
first written above.

_____________________          _____________________
John Smith                     Jane Jones
Claimant                       Defendant

Date: _______________          Date: _______________
""")
        return tmp.name


async def create_test_data():
    """Create test user, case, and document records"""
    async with AsyncSessionLocal() as db:
        # Create test user
        user = User(
            email="test@example.com",
            username="testuser",
            full_name="Test User",
            password_hash="$2b$12$test",  # Dummy hash
            role="solicitor",
            is_active=True
        )
        db.add(user)
        await db.flush()
        
        # Create test case
        case = Case(
            title="Smith v Jones Settlement",
            case_number="SJ2024001",
            case_type="settlement",
            status="active",
            created_by_id=user.id,
            description="Test case for pipeline integration"
        )
        db.add(case)
        await db.flush()
        
        # Create test file
        test_file = create_test_text_file()
        
        # Create document record
        document = Document(
            case_id=case.id,
            filename="settlement_agreement.txt",
            file_path=test_file,
            mime_type="text/plain",
            file_size=os.path.getsize(test_file),
            file_hash="test_hash_" + str(uuid.uuid4())[:8],
            document_type="settlement_agreement",
            document_date=datetime.now(),
            uploaded_by_id=user.id,
            title="Settlement Agreement",
            language="en"
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        return user, case, document, test_file


async def cleanup_test_data(user_id, case_id, document_id, test_file):
    """Clean up test data"""
    async with AsyncSessionLocal() as db:
        # Delete chunks
        chunks_result = await db.execute(
            f"DELETE FROM document_chunks WHERE document_id = '{document_id}'"
        )
        
        # Delete document
        document = await db.get(Document, document_id)
        if document:
            await db.delete(document)
        
        # Delete case
        case = await db.get(Case, case_id)
        if case:
            await db.delete(case)
            
        # Delete user
        user = await db.get(User, user_id)
        if user:
            await db.delete(user)
        
        await db.commit()
    
    # Remove test file
    if os.path.exists(test_file):
        os.unlink(test_file)


async def test_integration():
    """Test full pipeline integration with database"""
    logger.info("Starting integration test")
    
    user = case = document = test_file = None
    
    try:
        # Create test data
        logger.info("Creating test data")
        user, case, document, test_file = await create_test_data()
        
        logger.info("Test data created",
                   user_id=str(user.id),
                   case_id=str(case.id), 
                   document_id=str(document.id),
                   file_path=test_file)
        
        # Run the pipeline
        logger.info("Starting pipeline processing")
        result = await process_document_pipeline(str(document.id))
        
        # Check results
        if result["status"] == "completed":
            logger.info("Pipeline completed successfully", **result["statistics"])
            
            # Verify database state
            async with AsyncSessionLocal() as db:
                # Reload document
                doc = await db.get(Document, document.id)
                logger.info("Document status",
                           processed=doc.processed,
                           ocr_completed=doc.ocr_completed,
                           chunks_generated=doc.chunks_generated,
                           page_count=doc.page_count)
                
                # Check chunks
                chunks_result = await db.execute(
                    f"SELECT * FROM document_chunks WHERE document_id = '{document.id}'"
                )
                chunks = chunks_result.fetchall()
                
                if chunks:
                    logger.info("Chunks created", count=len(chunks))
                    
                    # Check embeddings
                    embedded_chunks = [c for c in chunks if c.embedding is not None]
                    logger.info("Embeddings generated", 
                               embedded=len(embedded_chunks),
                               total=len(chunks))
                    
                    if embedded_chunks:
                        sample_embedding = embedded_chunks[0].embedding
                        logger.info("Sample embedding",
                                   dimension=len(sample_embedding) if sample_embedding else 0,
                                   sample_values=sample_embedding[:5] if sample_embedding else None)
                    
                    print("\n" + "="*60)
                    print(" INTEGRATION TEST RESULTS")
                    print("="*60)
                    print("✅ SUCCESS")
                    print(f"Document processed: {doc.processed}")
                    print(f"OCR completed: {doc.ocr_completed}")
                    print(f"Total chunks: {len(chunks)}")
                    print(f"Embedded chunks: {len(embedded_chunks)}")
                    print(f"Text length: {len(doc.ocr_text) if doc.ocr_text else 0}")
                    print(f"Processing steps: {', '.join(result['steps_completed'])}")
                    
                    if embedded_chunks:
                        embedding_dim = len(embedded_chunks[0].embedding)
                        print(f"Embedding dimension: {embedding_dim}")
                    
                    print("\nSample chunk:")
                    if chunks:
                        chunk = chunks[0]
                        print(f"  Index: {chunk.chunk_index}")
                        print(f"  Tokens: {chunk.tokens}")
                        print(f"  Text preview: {chunk.text[:100]}...")
                        if chunk.embedding:
                            print(f"  Has embedding: Yes ({len(chunk.embedding)} dimensions)")
                        else:
                            print(f"  Has embedding: No")
                    
                    print("")
                    return True
                else:
                    logger.error("No chunks were created")
                    print("\n❌ FAILED: No chunks created")
                    return False
        else:
            logger.error("Pipeline failed", **result)
            print(f"\n❌ FAILED: {result.get('errors', 'Unknown error')}")
            return False
            
    except Exception as e:
        logger.error("Integration test failed", error=str(e))
        print(f"\n❌ FAILED: {str(e)}")
        return False
        
    finally:
        # Cleanup
        if all([user, case, document, test_file]):
            logger.info("Cleaning up test data")
            try:
                await cleanup_test_data(user.id, case.id, document.id, test_file)
                logger.info("Cleanup completed")
            except Exception as e:
                logger.warning("Cleanup failed", error=str(e))


async def main():
    success = await test_integration()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())