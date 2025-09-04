"""
Embeddings generation service using sentence-transformers with enhanced caching and performance
"""

import numpy as np
from typing import List, Union, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
import torch
import hashlib
import json
import time
import structlog
from app.core.config import settings
from app.core.redis import get_redis

logger = structlog.get_logger()

# Initialize model globally to avoid reloading
_model = None
_model_info = None


def get_embedding_model():
    """Get or initialize the embedding model with enhanced info tracking"""
    global _model, _model_info
    if _model is None:
        logger.info("Initializing embedding model", model=settings.EMBEDDING_MODEL)
        
        # Determine device
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        try:
            # Use a smaller model that works well for legal documents
            # all-MiniLM-L6-v2 is 384 dimensions, fast and accurate
            _model = SentenceTransformer(
                settings.EMBEDDING_MODEL,
                device=device
            )
            
            # Store model information
            _model_info = {
                "model_name": settings.EMBEDDING_MODEL,
                "device": device,
                "max_seq_length": _model.max_seq_length,
                "dimension": _model.get_sentence_embedding_dimension(),
                "tokenizer_name": _model[0].auto_model.config.name_or_path if hasattr(_model[0], 'auto_model') else "unknown"
            }
            
            logger.info("Embedding model initialized successfully", **_model_info)
            
        except Exception as e:
            logger.error("Failed to initialize embedding model", 
                        model=settings.EMBEDDING_MODEL, 
                        device=device, 
                        error=str(e))
            raise
    
    return _model


def get_model_info() -> Dict[str, Any]:
    """Get information about the current embedding model"""
    get_embedding_model()  # Ensure model is initialized
    return _model_info or {}


def _create_cache_key(text: str, prefix: str = "emb") -> str:
    """Create a cache key for text embedding"""
    text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]
    return f"{prefix}:{text_hash}"


async def _get_cached_embedding(text: str) -> Optional[np.ndarray]:
    """Get embedding from Redis cache"""
    try:
        redis_client = get_redis()
        cache_key = _create_cache_key(text)
        cached_data = redis_client.get(cache_key)
        
        if cached_data:
            # Deserialize the numpy array
            embedding_data = json.loads(cached_data)
            return np.array(embedding_data, dtype=np.float32)
    except Exception as e:
        logger.warning("Failed to get cached embedding", error=str(e))
    
    return None


async def _cache_embedding(text: str, embedding: np.ndarray, ttl: int = 86400) -> None:
    """Cache embedding in Redis with TTL (default 24 hours)"""
    try:
        redis_client = get_redis()
        cache_key = _create_cache_key(text)
        
        # Serialize numpy array to JSON
        embedding_data = embedding.tolist()
        serialized = json.dumps(embedding_data)
        
        redis_client.setex(cache_key, ttl, serialized)
        logger.debug("Cached embedding", cache_key=cache_key, size=embedding.shape)
    except Exception as e:
        logger.warning("Failed to cache embedding", error=str(e))


async def generate_embeddings(
    text: Union[str, List[str]],
    use_cache: bool = True,
    batch_size: int = 32
) -> Union[np.ndarray, List[np.ndarray]]:
    """
    Generate embeddings for text or list of texts with caching
    
    Args:
        text: Single text string or list of texts
        use_cache: Whether to use Redis caching
        batch_size: Batch size for processing multiple texts
    
    Returns:
        Single embedding vector or list of embedding vectors
    """
    
    logger.debug("Generating embeddings", 
                text_count=1 if isinstance(text, str) else len(text),
                use_cache=use_cache)
    
    model = get_embedding_model()
    
    if isinstance(text, str):
        # Single text - check cache first
        if use_cache:
            cached_embedding = await _get_cached_embedding(text)
            if cached_embedding is not None:
                logger.debug("Using cached embedding")
                return cached_embedding
        
        # Generate new embedding
        embedding = model.encode(
            text,
            normalize_embeddings=True,
            convert_to_numpy=True
        )
        
        # Cache the result
        if use_cache:
            await _cache_embedding(text, embedding)
        
        return embedding
    
    else:
        # Batch processing
        embeddings = []
        texts_to_process = []
        cached_results = {}
        
        # Check cache for each text if enabled
        if use_cache:
            for i, single_text in enumerate(text):
                cached_embedding = await _get_cached_embedding(single_text)
                if cached_embedding is not None:
                    cached_results[i] = cached_embedding
                else:
                    texts_to_process.append((i, single_text))
        else:
            texts_to_process = list(enumerate(text))
        
        # Process uncached texts
        if texts_to_process:
            uncached_texts = [t[1] for t in texts_to_process]
            logger.debug("Processing uncached texts", count=len(uncached_texts))
            
            new_embeddings = model.encode(
                uncached_texts,
                normalize_embeddings=True,
                convert_to_numpy=True,
                batch_size=batch_size,
                show_progress_bar=False
            )
            
            # Cache new embeddings
            if use_cache:
                for (original_idx, original_text), embedding in zip(texts_to_process, new_embeddings):
                    await _cache_embedding(original_text, embedding)
                    cached_results[original_idx] = embedding
            else:
                for (original_idx, _), embedding in zip(texts_to_process, new_embeddings):
                    cached_results[original_idx] = embedding
        
        # Reconstruct results in original order
        embeddings = [cached_results[i] for i in range(len(text))]
        
        logger.debug("Embeddings generated", 
                    total=len(embeddings), 
                    cached=len(text) - len(texts_to_process),
                    generated=len(texts_to_process))
        
        return embeddings


async def generate_query_embedding(query: str, use_cache: bool = True) -> np.ndarray:
    """
    Generate embedding for a search query with query-specific caching
    Might use different preprocessing for queries vs documents
    """
    
    # Add query prefix for better retrieval (some models benefit from this)
    query_text = f"query: {query}"
    
    # Use query-specific cache key
    if use_cache:
        cached_embedding = await _get_cached_embedding(query_text)
        if cached_embedding is not None:
            logger.debug("Using cached query embedding")
            return cached_embedding
    
    model = get_embedding_model()
    embedding = model.encode(
        query_text,
        normalize_embeddings=True,
        convert_to_numpy=True
    )
    
    # Cache with shorter TTL for queries (1 hour)
    if use_cache:
        await _cache_embedding(query_text, embedding, ttl=3600)
    
    return embedding


async def batch_generate_embeddings(
    texts: List[str],
    batch_size: int = 32,
    use_cache: bool = True,
    show_progress: bool = False
) -> List[np.ndarray]:
    """
    Generate embeddings for a large list of texts in batches with caching
    
    This is a convenience wrapper around generate_embeddings for backward compatibility
    """
    
    logger.info("Batch generating embeddings", 
                total_texts=len(texts), 
                batch_size=batch_size, 
                use_cache=use_cache)
    
    # Use the enhanced generate_embeddings function which handles caching
    embeddings = await generate_embeddings(
        texts, 
        use_cache=use_cache, 
        batch_size=batch_size
    )
    
    return embeddings


def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Calculate cosine similarity between two vectors
    """
    
    # Since we normalize embeddings, dot product = cosine similarity
    return float(np.dot(vec1, vec2))


def find_similar_chunks(
    query_embedding: np.ndarray,
    chunk_embeddings: List[np.ndarray],
    top_k: int = 5,
    threshold: float = 0.5
) -> List[tuple]:
    """
    Find most similar chunks to a query with optimized similarity computation
    
    Returns:
        List of (index, similarity_score) tuples sorted by similarity
    """
    
    if not chunk_embeddings:
        return []
    
    # Convert to numpy array for vectorized operations
    embeddings_array = np.array(chunk_embeddings)
    
    # Compute similarities using matrix multiplication (much faster)
    similarities = np.dot(embeddings_array, query_embedding)
    
    # Filter by threshold and get indices
    valid_indices = np.where(similarities >= threshold)[0]
    
    if len(valid_indices) == 0:
        return []
    
    # Create result tuples and sort by similarity
    results = [(int(idx), float(similarities[idx])) for idx in valid_indices]
    results.sort(key=lambda x: x[1], reverse=True)
    
    return results[:top_k]


async def clear_embedding_cache(pattern: str = "emb:*") -> int:
    """
    Clear embedding cache entries matching pattern
    
    Args:
        pattern: Redis key pattern to match (default: all embeddings)
    
    Returns:
        Number of keys deleted
    """
    try:
        redis_client = get_redis()
        keys = redis_client.keys(pattern)
        if keys:
            deleted = redis_client.delete(*keys)
            logger.info("Cleared embedding cache", pattern=pattern, deleted=deleted)
            return deleted
        return 0
    except Exception as e:
        logger.error("Failed to clear embedding cache", pattern=pattern, error=str(e))
        return 0


async def get_cache_stats() -> Dict[str, Any]:
    """
    Get embedding cache statistics
    
    Returns:
        Dictionary with cache statistics
    """
    try:
        redis_client = get_redis()
        
        # Count different types of cached embeddings
        embedding_keys = redis_client.keys("emb:*")
        query_keys = redis_client.keys("emb:*query:*")
        
        # Get memory usage info
        info = redis_client.info('memory')
        
        stats = {
            "total_cached_embeddings": len(embedding_keys),
            "cached_queries": len(query_keys),
            "cached_documents": len(embedding_keys) - len(query_keys),
            "redis_memory_used": info.get('used_memory_human', 'unknown'),
            "redis_memory_peak": info.get('used_memory_peak_human', 'unknown')
        }
        
        # Add model info
        model_info = get_model_info()
        stats["model_info"] = model_info
        
        return stats
        
    except Exception as e:
        logger.error("Failed to get cache stats", error=str(e))
        return {"error": str(e)}


async def precompute_embeddings(texts: List[str], batch_size: int = 32) -> Dict[str, Any]:
    """
    Precompute and cache embeddings for a list of texts
    
    Args:
        texts: List of texts to precompute embeddings for
        batch_size: Batch size for processing
    
    Returns:
        Statistics about the precomputation process
    """
    logger.info("Starting embedding precomputation", total_texts=len(texts))
    
    start_time = time.time()
    
    # Generate embeddings (will cache automatically)
    embeddings = await generate_embeddings(texts, use_cache=True, batch_size=batch_size)
    
    end_time = time.time()
    processing_time = end_time - start_time
    
    stats = {
        "total_texts": len(texts),
        "processing_time_seconds": round(processing_time, 2),
        "texts_per_second": round(len(texts) / processing_time, 2),
        "batch_size": batch_size,
        "embeddings_generated": len(embeddings)
    }
    
    logger.info("Embedding precomputation completed", **stats)
    return stats