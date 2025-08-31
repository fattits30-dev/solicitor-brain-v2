"""
Document chunking service for RAG pipeline
"""

from typing import List, Tuple
import re
from langchain.text_splitter import RecursiveCharacterTextSplitter


async def chunk_document(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    min_chunk_size: int = 100
) -> List[str]:
    """
    Split document into overlapping chunks for RAG
    
    Args:
        text: Document text to chunk
        chunk_size: Target size of each chunk in characters
        chunk_overlap: Number of characters to overlap between chunks
        min_chunk_size: Minimum size of a chunk
    
    Returns:
        List of text chunks
    """
    
    if not text or len(text.strip()) < min_chunk_size:
        return []
    
    # Clean the text
    text = clean_text(text)
    
    # Use LangChain's splitter for better semantic chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=[
            "\n\n\n",  # Triple newline (strong section break)
            "\n\n",    # Double newline (paragraph break)
            "\n",      # Single newline
            ". ",      # Sentence end
            "! ",      # Exclamation
            "? ",      # Question
            "; ",      # Semicolon
            ", ",      # Comma
            " ",       # Space
            ""         # Character
        ]
    )
    
    chunks = text_splitter.split_text(text)
    
    # Filter out chunks that are too small
    chunks = [chunk for chunk in chunks if len(chunk.strip()) >= min_chunk_size]
    
    # Add context to chunks if needed
    chunks = add_chunk_context(chunks)
    
    return chunks


def clean_text(text: str) -> str:
    """
    Clean text for better chunking
    """
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Fix spacing around punctuation
    text = re.sub(r'\s+([.!?,;:])', r'\1', text)
    
    # Remove page markers from OCR
    text = re.sub(r'--- Page \d+ ---', '\n\n', text)
    
    # Remove common OCR artifacts
    text = re.sub(r'[^\x00-\x7F]+', ' ', text)  # Remove non-ASCII
    
    # Normalize line breaks
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\r', '\n', text)
    
    return text.strip()


def add_chunk_context(chunks: List[str]) -> List[str]:
    """
    Add context information to chunks if needed
    """
    enhanced_chunks = []
    
    for i, chunk in enumerate(chunks):
        # Check if chunk starts mid-sentence
        if i > 0 and not chunk[0].isupper() and chunk[0].isalpha():
            # Try to add a bit of context from previous chunk
            prev_sentences = chunks[i-1].split('. ')
            if prev_sentences:
                last_sentence = prev_sentences[-1]
                if not last_sentence.endswith('.'):
                    chunk = last_sentence + ' ' + chunk
        
        enhanced_chunks.append(chunk.strip())
    
    return enhanced_chunks


def extract_chunk_metadata(chunk: str, chunk_index: int) -> dict:
    """
    Extract metadata from a chunk
    """
    metadata = {
        "chunk_index": chunk_index,
        "char_count": len(chunk),
        "word_count": len(chunk.split()),
        "sentence_count": len(re.findall(r'[.!?]+', chunk))
    }
    
    # Check for potential headings
    lines = chunk.split('\n')
    if lines:
        first_line = lines[0].strip()
        # Simple heuristic for headings
        if len(first_line) < 100 and first_line.isupper():
            metadata["heading"] = first_line
        elif len(first_line) < 100 and ':' in first_line:
            metadata["heading"] = first_line.split(':')[0]
    
    # Check for dates
    date_pattern = r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b'
    dates = re.findall(date_pattern, chunk)
    if dates:
        metadata["dates_mentioned"] = dates
    
    # Check for monetary amounts
    money_pattern = r'£[\d,]+(?:\.\d{2})?'
    amounts = re.findall(money_pattern, chunk)
    if amounts:
        metadata["amounts_mentioned"] = amounts
    
    return metadata


async def smart_chunk_document(
    text: str,
    document_type: str = None
) -> List[Tuple[str, dict]]:
    """
    Smart chunking based on document type with metadata
    
    Returns:
        List of (chunk_text, metadata) tuples
    """
    
    # Different strategies based on document type
    if document_type == "letter":
        chunk_size = 800
        chunk_overlap = 150
    elif document_type == "report":
        chunk_size = 1200
        chunk_overlap = 200
    elif document_type == "witness_statement":
        chunk_size = 1000
        chunk_overlap = 200
    else:
        chunk_size = 1000
        chunk_overlap = 200
    
    chunks = await chunk_document(text, chunk_size, chunk_overlap)
    
    # Add metadata to each chunk
    chunks_with_metadata = []
    for i, chunk in enumerate(chunks):
        metadata = extract_chunk_metadata(chunk, i)
        metadata["document_type"] = document_type
        chunks_with_metadata.append((chunk, metadata))
    
    return chunks_with_metadata