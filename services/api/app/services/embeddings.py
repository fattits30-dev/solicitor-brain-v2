"""
Embeddings generation service using sentence-transformers
"""

import numpy as np
from typing import List, Union
from sentence_transformers import SentenceTransformer
import torch
from app.core.config import settings

# Initialize model globally to avoid reloading
_model = None


def get_embedding_model():
    """Get or initialize the embedding model"""
    global _model
    if _model is None:
        # Use a smaller model that works well for legal documents
        # all-MiniLM-L6-v2 is 384 dimensions, fast and accurate
        _model = SentenceTransformer(
            settings.EMBEDDING_MODEL,
            device='cuda' if torch.cuda.is_available() else 'cpu'
        )
    return _model


async def generate_embeddings(
    text: Union[str, List[str]]
) -> Union[np.ndarray, List[np.ndarray]]:
    """
    Generate embeddings for text or list of texts
    
    Args:
        text: Single text string or list of texts
    
    Returns:
        Single embedding vector or list of embedding vectors
    """
    
    model = get_embedding_model()
    
    if isinstance(text, str):
        # Single text
        embedding = model.encode(
            text,
            normalize_embeddings=True,
            convert_to_numpy=True
        )
        return embedding
    else:
        # Batch processing
        embeddings = model.encode(
            text,
            normalize_embeddings=True,
            convert_to_numpy=True,
            batch_size=32,
            show_progress_bar=False
        )
        return embeddings


async def generate_query_embedding(query: str) -> np.ndarray:
    """
    Generate embedding for a search query
    Might use different preprocessing for queries vs documents
    """
    
    # Add query prefix for better retrieval (some models benefit from this)
    query_text = f"query: {query}"
    
    return await generate_embeddings(query_text)


async def batch_generate_embeddings(
    texts: List[str],
    batch_size: int = 32
) -> List[np.ndarray]:
    """
    Generate embeddings for a large list of texts in batches
    """
    
    model = get_embedding_model()
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        embeddings = model.encode(
            batch,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False
        )
        all_embeddings.extend(embeddings)
    
    return all_embeddings


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
    Find most similar chunks to a query
    
    Returns:
        List of (index, similarity_score) tuples
    """
    
    similarities = []
    for i, chunk_emb in enumerate(chunk_embeddings):
        sim = cosine_similarity(query_embedding, chunk_emb)
        if sim >= threshold:
            similarities.append((i, sim))
    
    # Sort by similarity score
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    return similarities[:top_k]