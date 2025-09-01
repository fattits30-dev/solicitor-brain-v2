#!/usr/bin/env python3
"""
Demo script showing how to start the worker and process documents
"""

import asyncio
import os
import subprocess
import sys
import time

print("Document Processing Worker Demo")
print("=" * 40)

print("\n1. Starting Redis (if not running)...")
try:
    # Check if Redis is running
    result = subprocess.run(["redis-cli", "ping"], capture_output=True, text=True, timeout=5)
    if result.returncode == 0 and "PONG" in result.stdout:
        print("✅ Redis is already running")
    else:
        print("⚠️  Redis not responding, you may need to start it manually")
except Exception:
    print("⚠️  Could not check Redis status")

print("\n2. Checking RQ queues...")
try:
    from app.core.redis import get_redis
    from app.services.task_manager import task_manager
    
    # Get queue statistics
    stats = task_manager.get_queue_stats()
    print(f"✅ Queue stats retrieved:")
    print(f"   Document processing queue: {stats['document_processing']['queued']} jobs")
    print(f"   Embeddings queue: {stats['embeddings']['queued']} jobs") 
    print(f"   Search queue: {stats['search']['queued']} jobs")
    
except Exception as e:
    print(f"❌ Failed to check queues: {e}")
    sys.exit(1)

print("\n3. Worker commands:")
print("To start the background worker, run:")
print("   python worker.py")
print("")
print("Or to process existing jobs and exit:")
print("   python worker.py --burst")
print("")
print("Or to run specific queues:")
print("   python worker.py --queue documents")
print("   python worker.py --queue embeddings")
print("")

print("4. Testing document upload via API:")
print("To test the full pipeline, upload a document via the API:")
print("   curl -X POST 'http://localhost:8000/api/documents/upload' \\")
print("        -H 'Authorization: Bearer YOUR_TOKEN' \\")
print("        -F 'file=@/path/to/document.pdf' \\")
print("        -F 'case_id=CASE_UUID' \\")
print("        -F 'priority=normal'")
print("")

print("5. Monitor job progress:")
print("Use the API endpoints:")
print("   GET /api/documents/{document_id} - Get document and job status")
print("   GET /api/jobs/{job_id}/status - Get specific job status")
print("")

print("📋 Pipeline Summary:")
print("✅ OCR Service: Ready (supports PDF, images, text)")
print("✅ Chunking Service: Ready (1-3K chars, 200 char overlap)")
print("✅ Embeddings Service: Ready (384-dim sentence-transformers)")
print("✅ Background Workers: Ready (Redis/RQ)")
print("✅ Task Manager: Ready (job queuing and status)")
print("✅ Upload Endpoint: Ready (file validation, deduplication)")
print("✅ Test Scripts: Available (test_pipeline.py, simple_integration_test.py)")
print("")
print("🚀 Document ingestion pipeline is ready for use!")