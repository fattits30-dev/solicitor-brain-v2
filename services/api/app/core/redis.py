"""
Redis connection and queue management
"""

import redis
from rq import Queue, Worker
from typing import Optional
import structlog

from app.core.config import settings

logger = structlog.get_logger()

# Global Redis connection
_redis_client: Optional[redis.Redis] = None
_queues: dict[str, Queue] = {}


def get_redis() -> redis.Redis:
    """Get or create Redis connection"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_keepalive=True,
            socket_keepalive_options={},
            health_check_interval=30,
        )
        logger.info("Connected to Redis", url=settings.REDIS_URL)
    return _redis_client


def get_queue(name: str = "default") -> Queue:
    """Get or create a named queue"""
    if name not in _queues:
        redis_conn = get_redis()
        _queues[name] = Queue(name, connection=redis_conn)
        logger.info("Created queue", queue_name=name)
    return _queues[name]


# Predefined queues for different types of work
def get_document_processing_queue() -> Queue:
    """Queue for document processing tasks (OCR, chunking, embeddings)"""
    return get_queue("document_processing")


def get_embedding_queue() -> Queue:
    """Queue for embedding generation tasks"""
    return get_queue("embeddings")


def get_search_queue() -> Queue:
    """Queue for search indexing tasks"""
    return get_queue("search")


async def health_check_redis() -> bool:
    """Check if Redis is available"""
    try:
        redis_client = get_redis()
        redis_client.ping()
        return True
    except Exception as e:
        logger.error("Redis health check failed", error=str(e))
        return False


def cleanup_redis():
    """Cleanup Redis connections"""
    global _redis_client, _queues
    if _redis_client:
        _redis_client.close()
        _redis_client = None
    _queues.clear()
    logger.info("Redis connections cleaned up")