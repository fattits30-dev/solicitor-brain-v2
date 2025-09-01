#!/usr/bin/env python3
"""
Background worker for document processing tasks

Usage:
    python worker.py                    # Start all queues
    python worker.py --queue documents  # Start specific queue
    python worker.py --burst            # Process existing jobs and exit
"""

import os
import sys
import argparse
from rq import Worker, Connection
import structlog

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.redis import get_redis, get_document_processing_queue, get_embedding_queue, get_search_queue
from app.core.config import settings

# Configure logging for worker
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
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


def main():
    """Main worker entry point"""
    parser = argparse.ArgumentParser(description="Solicitor Brain Background Worker")
    parser.add_argument(
        "--queue", 
        choices=["documents", "embeddings", "search", "all"], 
        default="all",
        help="Queue to process (default: all)"
    )
    parser.add_argument(
        "--burst", 
        action="store_true",
        help="Process existing jobs and exit"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose logging"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logger.info("Starting worker in verbose mode")
    
    # Get Redis connection
    redis_conn = get_redis()
    
    # Determine queues to process
    if args.queue == "documents":
        queues = [get_document_processing_queue()]
    elif args.queue == "embeddings":
        queues = [get_embedding_queue()]
    elif args.queue == "search":
        queues = [get_search_queue()]
    else:
        queues = [
            get_document_processing_queue(),
            get_embedding_queue(),
            get_search_queue()
        ]
    
    queue_names = [q.name for q in queues]
    logger.info("Starting worker", queues=queue_names, burst_mode=args.burst)
    
    try:
        with Connection(redis_conn):
            worker = Worker(
                queues,
                connection=redis_conn,
                name=f"solicitor-brain-worker-{os.getpid()}"
            )
            
            if args.burst:
                worker.work(burst=True)
                logger.info("Burst mode completed")
            else:
                logger.info("Worker started, waiting for jobs...")
                worker.work()
                
    except KeyboardInterrupt:
        logger.info("Worker interrupted by user")
    except Exception as e:
        logger.error("Worker failed", error=str(e))
        sys.exit(1)
    finally:
        logger.info("Worker shutting down")


if __name__ == "__main__":
    main()