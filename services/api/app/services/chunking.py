"""
Document chunking service for RAG pipeline with semantic chunking
"""

from typing import List, Tuple, Dict, Any, Optional
import re
import structlog
import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_text_splitters import TokenTextSplitter

logger = structlog.get_logger()


# Initialize tokenizer for accurate token counting
_tokenizer = None

def get_tokenizer():
    """Get or initialize tokenizer for token counting"""
    global _tokenizer
    if _tokenizer is None:
        _tokenizer = tiktoken.get_encoding("cl100k_base")
    return _tokenizer

def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken"""
    tokenizer = get_tokenizer()
    return len(tokenizer.encode(text))

async def chunk_document(
    text: str,
    chunk_size: int = 1000,  # Optimize for 1-3k chars (roughly 250-750 tokens)
    chunk_overlap: int = 200,  # 200 token overlap
    min_chunk_size: int = 50,   # Lower minimum for small documents
    use_semantic_chunking: bool = True
) -> List[Dict[str, Any]]:
    """
    Split document into overlapping chunks for RAG with enhanced metadata
    
    Args:
        text: Document text to chunk
        chunk_size: Target size of each chunk in tokens (aim for ~1000-3000 characters)
        chunk_overlap: Number of tokens to overlap between chunks (200 tokens ≈ 800 characters)
        min_chunk_size: Minimum size of a chunk in tokens
        use_semantic_chunking: Use semantic-aware chunking
    
    Returns:
        List of chunk dictionaries with text and metadata
    """
    
    logger.info("Starting document chunking", 
                text_length=len(text), 
                chunk_size=chunk_size, 
                overlap=chunk_overlap,
                semantic=use_semantic_chunking)
    
    if not text or len(text.strip()) < 50:
        logger.warning("Text too short for chunking", text_length=len(text))
        return []
    
    # Clean the text
    text = clean_text(text)
    
    if use_semantic_chunking:
        chunks_data = await semantic_chunk_document(text, chunk_size, chunk_overlap, min_chunk_size)
    else:
        chunks_data = await token_chunk_document(text, chunk_size, chunk_overlap, min_chunk_size)
    
    # Filter out chunks that are too small
    filtered_chunks = []
    for chunk_data in chunks_data:
        if chunk_data["token_count"] >= min_chunk_size:
            filtered_chunks.append(chunk_data)
        else:
            logger.debug("Filtered out small chunk", tokens=chunk_data["token_count"])
    
    logger.info("Chunking completed", 
                total_chunks=len(filtered_chunks),
                avg_tokens=sum(c["token_count"] for c in filtered_chunks) / len(filtered_chunks) if filtered_chunks else 0)
    
    return filtered_chunks


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


async def semantic_chunk_document(
    text: str, 
    chunk_size: int, 
    chunk_overlap: int, 
    min_chunk_size: int
) -> List[Dict[str, Any]]:
    """
    Semantic-aware chunking that respects document structure
    """
    
    # Use RecursiveCharacterTextSplitter with token counting
    # Aim for character-based sizing to meet requirements (1-3k chars)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size * 3,  # ~3000 characters (1000 tokens * 3 chars/token average)
        chunk_overlap=chunk_overlap * 3,  # ~600 characters overlap
        length_function=count_tokens,
        separators=[
            "\n\n\n",  # Strong section breaks
            "\n\n",    # Paragraph breaks
            "\n",      # Line breaks
            ". ",      # Sentence endings
            "! ",      # Exclamation
            "? ",      # Question
            "; ",      # Semicolon
            ", ",      # Comma
            " ",       # Space
            ""         # Character
        ],
        keep_separator=True
    )
    
    chunks = text_splitter.split_text(text)
    
    # Create chunk metadata
    chunks_data = []
    for i, chunk_text in enumerate(chunks):
        chunk_data = create_chunk_metadata(chunk_text, i)
        chunks_data.append(chunk_data)
    
    return chunks_data


async def token_chunk_document(
    text: str, 
    chunk_size: int, 
    chunk_overlap: int, 
    min_chunk_size: int
) -> List[Dict[str, Any]]:
    """
    Token-based chunking for precise token control
    """
    
    # Use TokenTextSplitter for exact token control
    text_splitter = TokenTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        encoding_name="cl100k_base"
    )
    
    chunks = text_splitter.split_text(text)
    
    # Create chunk metadata
    chunks_data = []
    for i, chunk_text in enumerate(chunks):
        chunk_data = create_chunk_metadata(chunk_text, i)
        chunks_data.append(chunk_data)
    
    return chunks_data


def create_chunk_metadata(chunk_text: str, chunk_index: int) -> Dict[str, Any]:
    """
    Create comprehensive metadata for a chunk
    """
    token_count = count_tokens(chunk_text)
    
    metadata = {
        "text": chunk_text.strip(),
        "chunk_index": chunk_index,
        "char_count": len(chunk_text),
        "word_count": len(chunk_text.split()),
        "token_count": token_count,
        "sentence_count": len(re.findall(r'[.!?]+', chunk_text)),
        "paragraph_count": len([p for p in chunk_text.split('\n\n') if p.strip()]),
        "has_heading": detect_heading(chunk_text),
        "heading_text": extract_heading(chunk_text),
        "dates_mentioned": extract_dates(chunk_text),
        "amounts_mentioned": extract_amounts(chunk_text),
        "legal_references": extract_legal_references(chunk_text)
    }
    
    return metadata


def detect_heading(text: str) -> bool:
    """
    Detect if chunk starts with a heading
    """
    lines = text.split('\n')
    if not lines:
        return False
        
    first_line = lines[0].strip()
    
    # Heuristics for headings
    if len(first_line) < 100 and (
        first_line.isupper() or  # ALL CAPS
        first_line.endswith(':') or  # Ends with colon
        re.match(r'^\d+\.', first_line) or  # Starts with number
        re.match(r'^[A-Z][a-z]', first_line) and not first_line.endswith('.')  # Title case without period
    ):
        return True
    
    return False


def extract_heading(text: str) -> Optional[str]:
    """
    Extract heading text if present
    """
    if detect_heading(text):
        lines = text.split('\n')
        return lines[0].strip() if lines else None
    return None


def extract_dates(text: str) -> List[str]:
    """
    Extract date mentions from text
    """
    date_patterns = [
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',  # DD/MM/YYYY or MM/DD/YYYY
        r'\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b',
        r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b'
    ]
    
    dates = []
    for pattern in date_patterns:
        dates.extend(re.findall(pattern, text, re.IGNORECASE))
    
    return list(set(dates))  # Remove duplicates


def extract_amounts(text: str) -> List[str]:
    """
    Extract monetary amounts from text
    """
    amount_patterns = [
        r'£[\d,]+(?:\.\d{2})?',  # British pounds
        r'\$[\d,]+(?:\.\d{2})?',  # US dollars
        r'€[\d,]+(?:\.\d{2})?',   # Euros
    ]
    
    amounts = []
    for pattern in amount_patterns:
        amounts.extend(re.findall(pattern, text))
    
    return amounts


def extract_legal_references(text: str) -> List[str]:
    """
    Extract legal references (case citations, statute references, etc.)
    """
    legal_patterns = [
        r'\b[A-Z][a-z]+\s+v\.?\s+[A-Z][a-z]+\b',  # Case names (Smith v Jones)
        r'\b\d{4}\s+[A-Z]{2,4}\s+\d+\b',  # Citation formats (2023 EWCA 123)
        r'\bs\.?\s*\d+[a-z]?(?:\(\d+\))?\b',  # Section references (s.1, s.1(2))
        r'\bAct\s+\d{4}\b',  # Act references (Act 2023)
        r'\bRegulation\s+\d+\b'  # Regulation references
    ]
    
    references = []
    for pattern in legal_patterns:
        references.extend(re.findall(pattern, text, re.IGNORECASE))
    
    return list(set(references))  # Remove duplicates


async def smart_chunk_document(
    text: str,
    document_type: Optional[str] = None,
    ocr_metadata: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Smart chunking based on document type with enhanced metadata
    
    Args:
        text: Document text to chunk
        document_type: Type of document (letter, report, witness_statement, etc.)
        ocr_metadata: OCR processing metadata to include
    
    Returns:
        List of chunk dictionaries with comprehensive metadata
    """
    
    logger.info("Starting smart document chunking", document_type=document_type)
    
    # Different strategies based on document type
    if document_type == "letter":
        chunk_size = 400  # Smaller chunks for letters
        chunk_overlap = 80
        use_semantic = True
    elif document_type == "report":
        chunk_size = 1000  # Larger chunks for reports
        chunk_overlap = 150
        use_semantic = True
    elif document_type == "witness_statement":
        chunk_size = 800   # Medium chunks for statements
        chunk_overlap = 120
        use_semantic = True
    elif document_type == "contract":
        chunk_size = 900   # Structured chunks for contracts
        chunk_overlap = 150
        use_semantic = True
    else:
        chunk_size = 800   # Default size
        chunk_overlap = 120
        use_semantic = True
    
    # Perform chunking
    chunks_data = await chunk_document(
        text, 
        chunk_size=chunk_size, 
        chunk_overlap=chunk_overlap,
        use_semantic_chunking=use_semantic
    )
    
    # Enhance metadata for each chunk
    for chunk_data in chunks_data:
        chunk_data["document_type"] = document_type
        
        # Add OCR metadata if available
        if ocr_metadata:
            chunk_data["source_extraction_method"] = ocr_metadata.get("extraction_method", "unknown")
            chunk_data["source_confidence"] = ocr_metadata.get("average_confidence")
            chunk_data["source_page_count"] = ocr_metadata.get("page_count")
        
        # Add document-type specific analysis
        if document_type == "contract":
            chunk_data["contract_clauses"] = extract_contract_clauses(chunk_data["text"])
        elif document_type == "witness_statement":
            chunk_data["statement_elements"] = extract_statement_elements(chunk_data["text"])
        elif document_type == "letter":
            chunk_data["letter_elements"] = extract_letter_elements(chunk_data["text"])
    
    logger.info("Smart chunking completed", 
                document_type=document_type,
                total_chunks=len(chunks_data),
                avg_tokens=sum(c["token_count"] for c in chunks_data) / len(chunks_data) if chunks_data else 0)
    
    return chunks_data


def extract_contract_clauses(text: str) -> List[str]:
    """
    Extract contract-specific clauses and terms
    """
    clause_patterns = [
        r'\b(?:whereas|therefore|notwithstanding|subject to|provided that)\b',
        r'\b(?:shall|must|will|may not|cannot)\b',
        r'\b(?:terminate|breach|default|remedy|damages)\b',
        r'\b(?:liability|indemnity|warranty|guarantee)\b'
    ]
    
    clauses = []
    for pattern in clause_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        clauses.extend(matches)
    
    return list(set(clauses))


def extract_statement_elements(text: str) -> Dict[str, List[str]]:
    """
    Extract witness statement specific elements
    """
    elements = {
        "time_references": re.findall(r'\b(?:at|on|during|before|after|when)\s+[^.]{1,50}', text, re.IGNORECASE),
        "locations": re.findall(r'\b(?:at|in|near|outside)\s+[A-Z][^.]{1,50}', text),
        "people_mentioned": re.findall(r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b', text),
        "actions": re.findall(r'\b(?:saw|heard|said|did|went|came|left)\s+[^.]{1,50}', text, re.IGNORECASE)
    }
    
    return elements


def extract_letter_elements(text: str) -> Dict[str, Optional[str]]:
    """
    Extract letter-specific elements
    """
    elements = {
        "greeting": None,
        "closing": None,
        "reference": None
    }
    
    # Look for greetings
    greeting_match = re.search(r'^\s*(?:Dear|To)\s+[^\n]{1,100}', text, re.MULTILINE | re.IGNORECASE)
    if greeting_match:
        elements["greeting"] = greeting_match.group().strip()
    
    # Look for closings
    closing_match = re.search(r'(?:Yours?\s+(?:sincerely|faithfully)|Best\s+regards?|Kind\s+regards?).*$', text, re.MULTILINE | re.IGNORECASE)
    if closing_match:
        elements["closing"] = closing_match.group().strip()
    
    # Look for reference numbers
    ref_match = re.search(r'\b(?:Ref|Reference)\s*:?\s*([A-Z0-9/-]+)', text, re.IGNORECASE)
    if ref_match:
        elements["reference"] = ref_match.group(1)
    
    return elements