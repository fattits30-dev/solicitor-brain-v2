#!/usr/bin/env python3
"""
Simple integration test for document processing pipeline
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
from app.models.document import Document
from app.models.case import Case
from app.models.user import User
from app.services.ocr import process_document_ocr, calculate_file_hash
from app.services.chunking import smart_chunk_document
from app.services.embeddings import generate_embeddings


def create_test_file():
    """Create a simple text file for testing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as tmp:
        tmp.write("""Legal Settlement Agreement

Case: Smith v Jones 2024
Date: January 1, 2024

This settlement agreement resolves all disputes between the parties.

Terms:
1. Payment of £15,000 within 30 days
2. Confidentiality clause applies
3. No admission of liability

The parties agree this represents their full agreement and supersedes
all previous negotiations. This document is governed by English law.

Signed by both parties on the date above.
""")
        return tmp.name


async def run_simple_test():
    """Run a simplified integration test"""
    print("Starting simple integration test...")
    
    test_file = None
    try:
        # Create test file
        test_file = create_test_file()
        print(f"Created test file: {test_file}")
        
        # Test OCR
        print("\nTesting OCR...")
        text, metadata = await process_document_ocr(test_file, "text/plain")
        print(f"✅ OCR successful: {len(text)} characters extracted")
        print(f"   Method: {metadata.get('extraction_method')}")
        
        # Test chunking
        print("\nTesting chunking...")
        chunks_data = await smart_chunk_document(text, document_type="settlement_agreement")
        print(f"✅ Chunking successful: {len(chunks_data)} chunks created")
        if chunks_data:
            avg_tokens = sum(c["token_count"] for c in chunks_data) / len(chunks_data)
            print(f"   Average tokens per chunk: {avg_tokens:.1f}")
            print(f"   Sample chunk: {chunks_data[0]['text'][:100]}...")
        
        # Test embeddings
        print("\nTesting embeddings...")
        if chunks_data:
            texts = [chunk["text"] for chunk in chunks_data]
            embeddings = await generate_embeddings(texts)
            print(f"✅ Embeddings successful: {len(embeddings)} vectors generated")
            if embeddings:
                print(f"   Dimension: {len(embeddings[0])}")
                print(f"   Sample values: {embeddings[0][:5]}")
        
        # Test file hash
        print("\nTesting file hash...")
        file_hash = await calculate_file_hash(test_file)
        print(f"✅ File hash: {file_hash[:16]}...")
        
        print(f"\n{'='*50}")
        print(" SIMPLE INTEGRATION TEST RESULTS")
        print(f"{'='*50}")
        print("✅ ALL TESTS PASSED")
        print(f"Text extracted: {len(text)} characters")
        print(f"Chunks created: {len(chunks_data)}")
        print(f"Embeddings generated: {len(embeddings) if chunks_data else 0}")
        print(f"File hash calculated: Yes")
        print("")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        return False
        
    finally:
        if test_file and os.path.exists(test_file):
            os.unlink(test_file)


if __name__ == "__main__":
    success = asyncio.run(run_simple_test())
    sys.exit(0 if success else 1)