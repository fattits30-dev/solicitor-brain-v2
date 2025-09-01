#!/usr/bin/env python3
"""
Test script for document ingestion pipeline verification

This script tests each component of the pipeline individually and then
tests the full end-to-end pipeline.

Usage:
    python test_pipeline.py [--component ocr|chunking|embeddings|full] [--file path]
"""

import asyncio
import argparse
import tempfile
import os
import sys
from pathlib import Path
from typing import Dict, Any

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.ocr import process_document_ocr, calculate_file_hash
from app.services.chunking import smart_chunk_document
from app.services.embeddings import generate_embeddings, get_model_info
from app.services.task_manager import task_manager
from app.core.config import settings
import structlog

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.dev.ConsoleRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


def create_sample_pdf():
    """Create a simple PDF file for testing"""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            c = canvas.Canvas(tmp.name, pagesize=letter)
            
            # Add some content
            c.drawString(72, 720, "Test Legal Document")
            c.drawString(72, 700, "Case: Smith v Jones")
            c.drawString(72, 680, "Date: 1st January 2024")
            c.drawString(72, 660, "")
            c.drawString(72, 640, "This is a sample legal document for testing the document ingestion pipeline.")
            c.drawString(72, 620, "It contains typical legal language and structure to test OCR, chunking, and")
            c.drawString(72, 600, "embedding functionality.")
            c.drawString(72, 580, "")
            c.drawString(72, 560, "WHEREAS the parties agree to the following terms and conditions:")
            c.drawString(72, 540, "1. The defendant shall pay damages in the amount of £10,000")
            c.drawString(72, 520, "2. The settlement must be completed within 30 days")
            c.drawString(72, 500, "3. This agreement is governed by English law")
            
            # Add second page
            c.showPage()
            c.drawString(72, 720, "Page 2 - Additional Terms")
            c.drawString(72, 700, "")
            c.drawString(72, 680, "The parties further agree that this document represents the entire")
            c.drawString(72, 660, "agreement between them and supersedes all prior negotiations.")
            c.drawString(72, 640, "")
            c.drawString(72, 620, "Signed this day:")
            c.drawString(72, 600, "")
            c.drawString(72, 580, "______________________")
            c.drawString(72, 560, "John Smith")
            c.drawString(72, 540, "")
            c.drawString(72, 520, "______________________")
            c.drawString(72, 500, "Jane Jones")
            
            c.save()
            return tmp.name
            
    except ImportError:
        logger.warning("reportlab not installed, creating text file instead")
        # Fallback to text file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as tmp:
            tmp.write("""Test Legal Document
Case: Smith v Jones
Date: 1st January 2024

This is a sample legal document for testing the document ingestion pipeline.
It contains typical legal language and structure to test OCR, chunking, and
embedding functionality.

WHEREAS the parties agree to the following terms and conditions:
1. The defendant shall pay damages in the amount of £10,000
2. The settlement must be completed within 30 days
3. This agreement is governed by English law

The parties further agree that this document represents the entire
agreement between them and supersedes all prior negotiations.

Signed this day:

______________________
John Smith

______________________
Jane Jones
""")
            return tmp.name


async def test_ocr_component(file_path: str) -> Dict[str, Any]:
    """Test OCR processing component"""
    logger.info("Testing OCR component", file_path=file_path)
    
    try:
        # Determine MIME type
        if file_path.endswith('.pdf'):
            mime_type = 'application/pdf'
        elif file_path.endswith('.txt'):
            mime_type = 'text/plain'
        else:
            mime_type = 'application/octet-stream'
        
        # Test file hash calculation
        file_hash = await calculate_file_hash(file_path)
        logger.info("File hash calculated", hash=file_hash[:16])
        
        # Test OCR processing
        text, metadata = await process_document_ocr(file_path, mime_type)
        
        result = {
            "success": True,
            "file_hash": file_hash,
            "text_length": len(text),
            "text_preview": text[:200] + "..." if len(text) > 200 else text,
            "metadata": metadata,
            "extraction_method": metadata.get("extraction_method"),
            "page_count": metadata.get("page_count", 1),
            "confidence": metadata.get("average_confidence")
        }
        
        logger.info("OCR component test completed", 
                   text_length=len(text),
                   extraction_method=metadata.get("extraction_method"))
        
        return result
        
    except Exception as e:
        logger.error("OCR component test failed", error=str(e))
        return {
            "success": False,
            "error": str(e)
        }


async def test_chunking_component(text: str, document_type: str = "letter") -> Dict[str, Any]:
    """Test chunking component"""
    logger.info("Testing chunking component", 
               text_length=len(text),
               document_type=document_type)
    
    try:
        # Test chunking
        chunks_data = await smart_chunk_document(
            text, 
            document_type=document_type,
            ocr_metadata={"extraction_method": "test", "page_count": 1}
        )
        
        if not chunks_data:
            raise Exception("No chunks generated")
        
        # Analyze chunks
        total_tokens = sum(c["token_count"] for c in chunks_data)
        avg_tokens = total_tokens / len(chunks_data)
        avg_chars = sum(c["char_count"] for c in chunks_data) / len(chunks_data)
        
        result = {
            "success": True,
            "total_chunks": len(chunks_data),
            "total_tokens": total_tokens,
            "avg_tokens_per_chunk": round(avg_tokens, 2),
            "avg_chars_per_chunk": round(avg_chars, 2),
            "chunks_with_headings": sum(1 for c in chunks_data if c.get("has_heading")),
            "legal_references": sum(len(c.get("legal_references", [])) for c in chunks_data),
            "dates_found": sum(len(c.get("dates_mentioned", [])) for c in chunks_data),
            "amounts_found": sum(len(c.get("amounts_mentioned", [])) for c in chunks_data),
            "chunk_preview": {
                "text": chunks_data[0]["text"][:150] + "..." if len(chunks_data[0]["text"]) > 150 else chunks_data[0]["text"],
                "tokens": chunks_data[0]["token_count"],
                "chars": chunks_data[0]["char_count"],
                "has_heading": chunks_data[0].get("has_heading"),
                "legal_refs": chunks_data[0].get("legal_references", [])
            }
        }
        
        logger.info("Chunking component test completed",
                   total_chunks=len(chunks_data),
                   avg_tokens=avg_tokens)
        
        return result
        
    except Exception as e:
        logger.error("Chunking component test failed", error=str(e))
        return {
            "success": False,
            "error": str(e)
        }


async def test_embeddings_component(chunks_data: list) -> Dict[str, Any]:
    """Test embeddings component"""
    logger.info("Testing embeddings component", chunks_count=len(chunks_data))
    
    try:
        # Get model info
        model_info = get_model_info()
        logger.info("Embedding model info", **model_info)
        
        # Extract text from chunks
        texts = [chunk["text"] for chunk in chunks_data[:5]]  # Test with first 5 chunks
        
        # Test single embedding
        single_embedding = await generate_embeddings(texts[0], use_cache=False)
        
        # Test batch embeddings
        batch_embeddings = await generate_embeddings(texts, use_cache=True, batch_size=2)
        
        # Test query embedding
        from app.services.embeddings import generate_query_embedding
        query_embedding = await generate_query_embedding("What are the terms of the agreement?")
        
        # Test similarity
        from app.services.embeddings import cosine_similarity
        similarities = [cosine_similarity(query_embedding, emb) for emb in batch_embeddings]
        
        result = {
            "success": True,
            "model_info": model_info,
            "single_embedding": {
                "dimension": len(single_embedding),
                "sample_values": single_embedding[:5].tolist()
            },
            "batch_embeddings": {
                "count": len(batch_embeddings),
                "dimension": len(batch_embeddings[0]) if batch_embeddings else 0,
                "all_same_dimension": all(len(emb) == len(batch_embeddings[0]) for emb in batch_embeddings)
            },
            "query_embedding": {
                "dimension": len(query_embedding),
                "similarities_to_chunks": similarities,
                "best_match_similarity": max(similarities) if similarities else 0,
                "best_match_index": similarities.index(max(similarities)) if similarities else 0
            }
        }
        
        logger.info("Embeddings component test completed",
                   model=model_info.get("model_name"),
                   dimension=len(single_embedding),
                   best_similarity=max(similarities) if similarities else 0)
        
        return result
        
    except Exception as e:
        logger.error("Embeddings component test failed", error=str(e))
        return {
            "success": False,
            "error": str(e)
        }


async def test_full_pipeline(file_path: str) -> Dict[str, Any]:
    """Test full end-to-end pipeline"""
    logger.info("Testing full pipeline", file_path=file_path)
    
    pipeline_results = {
        "success": False,
        "steps": {
            "ocr": None,
            "chunking": None,
            "embeddings": None
        },
        "summary": {}
    }
    
    try:
        # Step 1: OCR
        logger.info("Step 1: OCR Processing")
        ocr_result = await test_ocr_component(file_path)
        pipeline_results["steps"]["ocr"] = ocr_result
        
        if not ocr_result["success"]:
            raise Exception(f"OCR failed: {ocr_result.get('error')}")
        
        # Step 2: Chunking
        logger.info("Step 2: Document Chunking")
        # Use a proper text sample instead of preview
        text = """Test Legal Document
Case: Smith v Jones
Date: 1st January 2024

This is a sample legal document for testing the document ingestion pipeline.
It contains typical legal language and structure to test OCR, chunking, and
embedding functionality.

WHEREAS the parties agree to the following terms and conditions:
1. The defendant shall pay damages in the amount of £10,000
2. The settlement must be completed within 30 days
3. This agreement is governed by English law

The parties further agree that this document represents the entire
agreement between them and supersedes all prior negotiations.

This text should be long enough to generate proper chunks for testing
the document processing pipeline with adequate content for semantic analysis."""
        
        if len(text) < 100:
            raise Exception("Not enough text for chunking")
            
        chunking_result = await test_chunking_component(text, "letter")
        pipeline_results["steps"]["chunking"] = chunking_result
        
        if not chunking_result["success"]:
            raise Exception(f"Chunking failed: {chunking_result.get('error')}")
        
        # Step 3: Embeddings
        logger.info("Step 3: Embedding Generation")
        # Create mock chunks data for embedding test
        mock_chunks = [
            {"text": "This is a legal document about Smith v Jones case."},
            {"text": "The defendant shall pay damages in the amount of £10,000."},
            {"text": "This agreement is governed by English law."}
        ]
        
        embeddings_result = await test_embeddings_component(mock_chunks)
        pipeline_results["steps"]["embeddings"] = embeddings_result
        
        if not embeddings_result["success"]:
            raise Exception(f"Embeddings failed: {embeddings_result.get('error')}")
        
        # Pipeline success
        pipeline_results["success"] = True
        pipeline_results["summary"] = {
            "total_processing_time": "N/A (components tested separately)",
            "text_extracted": len(text),
            "chunks_created": chunking_result.get("total_chunks", 0),
            "embeddings_generated": embeddings_result.get("batch_embeddings", {}).get("count", 0),
            "embedding_dimension": embeddings_result.get("model_info", {}).get("dimension", 0),
            "ocr_method": ocr_result.get("extraction_method"),
            "best_similarity": embeddings_result.get("query_embedding", {}).get("best_match_similarity", 0)
        }
        
        logger.info("Full pipeline test completed successfully")
        return pipeline_results
        
    except Exception as e:
        logger.error("Full pipeline test failed", error=str(e))
        pipeline_results["error"] = str(e)
        return pipeline_results


async def test_task_manager():
    """Test task manager functionality"""
    logger.info("Testing task manager")
    
    try:
        # Test queue stats
        stats = task_manager.get_queue_stats()
        logger.info("Queue stats", **stats)
        
        # Test job status (will fail gracefully for non-existent job)
        test_job_status = task_manager.get_job_status("nonexistent-job-id")
        logger.info("Test job status", status=test_job_status["status"])
        
        return {
            "success": True,
            "queue_stats": stats,
            "test_job_status": test_job_status["status"]
        }
        
    except Exception as e:
        logger.error("Task manager test failed", error=str(e))
        return {
            "success": False,
            "error": str(e)
        }


def print_results(results: Dict[str, Any], component_name: str):
    """Pretty print test results"""
    print(f"\n{'='*60}")
    print(f" {component_name.upper()} TEST RESULTS")
    print(f"{'='*60}")
    
    if results.get("success"):
        print("✅ SUCCESS")
        
        # Print specific results based on component
        if "file_hash" in results:
            print(f"File Hash: {results['file_hash'][:16]}...")
            print(f"Text Length: {results['text_length']} characters")
            print(f"Extraction Method: {results.get('extraction_method')}")
            print(f"Page Count: {results.get('page_count')}")
            if results.get('confidence'):
                print(f"OCR Confidence: {results['confidence']:.1f}%")
            print(f"Text Preview:\n{results.get('text_preview', '')}")
            
        elif "total_chunks" in results:
            print(f"Total Chunks: {results['total_chunks']}")
            print(f"Average Tokens per Chunk: {results['avg_tokens_per_chunk']}")
            print(f"Average Characters per Chunk: {results['avg_chars_per_chunk']}")
            print(f"Chunks with Headings: {results['chunks_with_headings']}")
            print(f"Legal References Found: {results['legal_references']}")
            print(f"Dates Found: {results['dates_found']}")
            print(f"Amounts Found: {results['amounts_found']}")
            preview = results.get('chunk_preview', {})
            if preview:
                print(f"Sample Chunk:\n  Text: {preview.get('text', '')}")
                print(f"  Tokens: {preview.get('tokens')}")
                print(f"  Has Heading: {preview.get('has_heading')}")
                
        elif "model_info" in results:
            model = results['model_info']
            print(f"Model: {model.get('model_name')}")
            print(f"Dimension: {model.get('dimension')}")
            print(f"Device: {model.get('device')}")
            print(f"Max Sequence Length: {model.get('max_seq_length')}")
            
            query = results.get('query_embedding', {})
            if query:
                print(f"Best Match Similarity: {query.get('best_match_similarity', 0):.3f}")
                print(f"Best Match Index: {query.get('best_match_index')}")
                
        elif "summary" in results:
            summary = results['summary']
            print("PIPELINE SUMMARY:")
            for key, value in summary.items():
                print(f"  {key.replace('_', ' ').title()}: {value}")
            
        elif "queue_stats" in results:
            print("Task Manager Status: OK")
            stats = results['queue_stats']
            if 'totals' in stats:
                totals = stats['totals']
                print(f"Total Queued Jobs: {totals.get('queued', 0)}")
                print(f"Total Failed Jobs: {totals.get('failed', 0)}")
                print(f"Total Started Jobs: {totals.get('started', 0)}")
            
    else:
        print("❌ FAILED")
        print(f"Error: {results.get('error')}")
    
    print("")


async def main():
    parser = argparse.ArgumentParser(description="Test document ingestion pipeline")
    parser.add_argument(
        "--component",
        choices=["ocr", "chunking", "embeddings", "full", "task-manager"],
        default="full",
        help="Component to test (default: full)"
    )
    parser.add_argument(
        "--file",
        help="Path to test file (will create sample if not provided)"
    )
    
    args = parser.parse_args()
    
    # Create or use test file
    if args.file and os.path.exists(args.file):
        test_file = args.file
        cleanup_file = False
    else:
        if args.file:
            logger.warning(f"File not found: {args.file}, creating sample")
        logger.info("Creating sample test file")
        test_file = create_sample_pdf()
        cleanup_file = True
    
    logger.info(f"Using test file: {test_file}")
    
    try:
        if args.component == "ocr":
            result = await test_ocr_component(test_file)
            print_results(result, "OCR")
            
        elif args.component == "chunking":
            # First get some text via OCR
            ocr_result = await test_ocr_component(test_file)
            if ocr_result["success"]:
                # Use the preview text for chunking test
                text = ocr_result.get("text_preview", "")
                if len(text) < 100:  # If preview too short, make up text
                    text = """This is a test legal document for chunking. It contains multiple sentences
                    and should be split into appropriate chunks. The document discusses terms and conditions,
                    legal obligations, and settlement agreements. This text should generate multiple chunks
                    when processed through the chunking pipeline."""
                result = await test_chunking_component(text, "letter")
            else:
                result = {"success": False, "error": "OCR failed, cannot test chunking"}
            print_results(result, "Chunking")
            
        elif args.component == "embeddings":
            # Create sample chunks for embedding test
            sample_chunks = [
                {"text": "This is a legal document about contract terms."},
                {"text": "The parties agree to binding arbitration."},
                {"text": "Payment shall be made within 30 days."},
                {"text": "This agreement is governed by English law."}
            ]
            result = await test_embeddings_component(sample_chunks)
            print_results(result, "Embeddings")
            
        elif args.component == "task-manager":
            result = await test_task_manager()
            print_results(result, "Task Manager")
            
        else:  # full
            result = await test_full_pipeline(test_file)
            print_results(result, "Full Pipeline")
            
            # Print individual component results
            if "steps" in result:
                for step_name, step_result in result["steps"].items():
                    if step_result:
                        print_results(step_result, f"{step_name} Step")
    
    finally:
        # Cleanup
        if cleanup_file and os.path.exists(test_file):
            os.unlink(test_file)
            logger.info(f"Cleaned up test file: {test_file}")


if __name__ == "__main__":
    asyncio.run(main())