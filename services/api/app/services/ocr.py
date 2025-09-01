"""
OCR service for document text extraction
"""

import os
import tempfile
import subprocess
from typing import Optional, Dict, Any, Tuple
import aiofiles
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
import PyPDF2
import io
import hashlib
import structlog
from pathlib import Path

logger = structlog.get_logger()


async def process_document_ocr(file_path: str, mime_type: str) -> Tuple[str, Dict[str, Any]]:
    """
    Extract text from document using OCR or direct text extraction
    
    Returns:
        Tuple of (extracted_text, metadata)
    """
    
    logger.info("Starting document OCR processing", file_path=file_path, mime_type=mime_type)
    
    try:
        if mime_type == "application/pdf":
            return await process_pdf_enhanced(file_path)
        elif mime_type.startswith("image/"):
            text = await process_image(file_path)
            metadata = await extract_image_metadata(file_path)
            return text, metadata
        elif mime_type in ["text/plain", "text/html", "text/markdown"]:
            text = await process_text_file(file_path)
            metadata = await extract_text_metadata(file_path)
            return text, metadata
        else:
            raise ValueError(f"Unsupported file type: {mime_type}")
    except Exception as e:
        logger.error("OCR processing failed", file_path=file_path, error=str(e))
        raise


async def process_pdf_enhanced(file_path: str) -> Tuple[str, Dict[str, Any]]:
    """
    Process PDF file with enhanced extraction and metadata
    
    Returns:
        Tuple of (extracted_text, metadata)
    """
    text_content = []
    metadata = {
        "extraction_method": "unknown",
        "page_count": 0,
        "has_text_layer": False,
        "ocr_confidence": None,
        "language_detected": "en",
        "processing_errors": []
    }
    
    # Try direct text extraction first
    try:
        async with aiofiles.open(file_path, 'rb') as file:
            pdf_bytes = await file.read()
            pdf_file = io.BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            metadata["page_count"] = len(pdf_reader.pages)
            
            # Extract metadata from PDF
            if pdf_reader.metadata:
                metadata["pdf_metadata"] = {
                    "title": pdf_reader.metadata.get("/Title", ""),
                    "author": pdf_reader.metadata.get("/Author", ""),
                    "subject": pdf_reader.metadata.get("/Subject", ""),
                    "creator": pdf_reader.metadata.get("/Creator", ""),
                    "producer": pdf_reader.metadata.get("/Producer", ""),
                    "creation_date": str(pdf_reader.metadata.get("/CreationDate", "")),
                    "modification_date": str(pdf_reader.metadata.get("/ModDate", ""))
                }
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                if text.strip():
                    text_content.append(f"--- Page {page_num + 1} ---\n{text}")
                    metadata["has_text_layer"] = True
            
            # If we got text, return it
            if text_content:
                metadata["extraction_method"] = "direct_text"
                combined_text = "\n\n".join(text_content)
                logger.info("PDF direct text extraction successful", 
                           page_count=metadata["page_count"], 
                           text_length=len(combined_text))
                return combined_text, metadata
                
    except Exception as e:
        error_msg = f"Direct PDF text extraction failed: {e}"
        logger.warning(error_msg, file_path=file_path)
        metadata["processing_errors"].append(error_msg)
    
    # Fall back to OCR
    logger.info("Falling back to OCR for PDF", file_path=file_path)
    text, ocr_metadata = await ocr_pdf_enhanced(file_path)
    metadata.update(ocr_metadata)
    return text, metadata


async def ocr_pdf_enhanced(file_path: str) -> Tuple[str, Dict[str, Any]]:
    """
    OCR a PDF file by converting pages to images with enhanced processing
    
    Returns:
        Tuple of (extracted_text, metadata)
    """
    text_content = []
    metadata = {
        "extraction_method": "ocr",
        "page_count": 0,
        "ocr_confidence": [],
        "failed_pages": [],
        "processing_errors": []
    }
    
    try:
        # Convert PDF to images
        with tempfile.TemporaryDirectory() as temp_dir:
            logger.info("Converting PDF to images for OCR", file_path=file_path)
            
            images = convert_from_path(
                file_path,
                dpi=300,
                output_folder=temp_dir,
                fmt='png',
                thread_count=4
            )
            
            metadata["page_count"] = len(images)
            
            for i, image in enumerate(images):
                try:
                    # Perform OCR on each page with confidence data
                    ocr_data = pytesseract.image_to_data(
                        image,
                        lang='eng',
                        config='--psm 1 --oem 3',
                        output_type=pytesseract.Output.DICT
                    )
                    
                    # Extract text
                    text = pytesseract.image_to_string(
                        image,
                        lang='eng',
                        config='--psm 1 --oem 3'
                    )
                    
                    # Calculate average confidence
                    confidences = [int(conf) for conf in ocr_data['conf'] if int(conf) > 0]
                    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
                    metadata["ocr_confidence"].append(avg_confidence)
                    
                    if text.strip():
                        text_content.append(f"--- Page {i + 1} ---\n{text}")
                    else:
                        metadata["failed_pages"].append(i + 1)
                        
                except Exception as page_error:
                    error_msg = f"OCR failed for page {i + 1}: {page_error}"
                    logger.error(error_msg, file_path=file_path)
                    metadata["processing_errors"].append(error_msg)
                    metadata["failed_pages"].append(i + 1)
            
            # Calculate overall confidence
            if metadata["ocr_confidence"]:
                metadata["average_confidence"] = sum(metadata["ocr_confidence"]) / len(metadata["ocr_confidence"])
            else:
                metadata["average_confidence"] = 0
            
            combined_text = "\n\n".join(text_content)
            logger.info("OCR processing completed", 
                       file_path=file_path,
                       pages_processed=len(images),
                       pages_failed=len(metadata["failed_pages"]),
                       avg_confidence=metadata["average_confidence"],
                       text_length=len(combined_text))
            
            return combined_text, metadata
            
    except Exception as e:
        error_msg = f"OCR processing failed: {e}"
        logger.error(error_msg, file_path=file_path)
        metadata["processing_errors"].append(error_msg)
        raise


async def process_image(file_path: str) -> str:
    """
    OCR an image file
    """
    image = Image.open(file_path)
    
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Perform OCR
    text = pytesseract.image_to_string(
        image,
        lang='eng',
        config='--psm 1 --oem 3'
    )
    
    return text


async def process_text_file(file_path: str) -> str:
    """
    Read text from a text file
    """
    async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
        content = await file.read()
    return content


async def extract_image_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extract metadata from image files
    """
    metadata = {
        "extraction_method": "image_ocr",
        "file_size": 0,
        "dimensions": None,
        "format": None
    }
    
    try:
        file_stat = os.stat(file_path)
        metadata["file_size"] = file_stat.st_size
        
        with Image.open(file_path) as img:
            metadata["dimensions"] = img.size
            metadata["format"] = img.format
            metadata["mode"] = img.mode
            
    except Exception as e:
        logger.error("Failed to extract image metadata", file_path=file_path, error=str(e))
        
    return metadata


async def extract_text_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extract metadata from text files
    """
    metadata = {
        "extraction_method": "direct_text",
        "file_size": 0,
        "encoding": "utf-8",
        "line_count": 0
    }
    
    try:
        file_stat = os.stat(file_path)
        metadata["file_size"] = file_stat.st_size
        
        # Try to detect encoding
        async with aiofiles.open(file_path, 'rb') as f:
            sample = await f.read(1024)
            try:
                sample.decode('utf-8')
                metadata["encoding"] = "utf-8"
            except UnicodeDecodeError:
                try:
                    sample.decode('latin-1')
                    metadata["encoding"] = "latin-1"
                except UnicodeDecodeError:
                    metadata["encoding"] = "unknown"
        
        # Count lines
        async with aiofiles.open(file_path, 'r', encoding=metadata["encoding"]) as f:
            content = await f.read()
            metadata["line_count"] = content.count('\n')
            
    except Exception as e:
        logger.error("Failed to extract text metadata", file_path=file_path, error=str(e))
        
    return metadata


async def ocrmypdf_process(input_path: str, output_path: str) -> Tuple[bool, Dict[str, Any]]:
    """
    Use ocrmypdf for enhanced PDF processing
    
    Returns:
        Tuple of (success, metadata)
    """
    metadata = {
        "ocrmypdf_used": True,
        "processing_errors": [],
        "output_file_size": 0
    }
    
    try:
        # Run ocrmypdf as subprocess
        cmd = [
            "ocrmypdf",
            "--language", "eng",
            "--deskew",
            "--clean",
            "--optimize", "1",
            "--jpeg-quality", "95",
            "--png-quality", "95",
            input_path,
            output_path
        ]
        
        logger.info("Running ocrmypdf", input_path=input_path, output_path=output_path)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            # Check output file
            if os.path.exists(output_path):
                stat = os.stat(output_path)
                metadata["output_file_size"] = stat.st_size
                logger.info("ocrmypdf completed successfully", 
                           input_path=input_path,
                           output_size=metadata["output_file_size"])
                return True, metadata
            else:
                metadata["processing_errors"].append("Output file not created")
                return False, metadata
        else:
            error_msg = f"ocrmypdf failed with code {result.returncode}: {result.stderr}"
            metadata["processing_errors"].append(error_msg)
            logger.error(error_msg, input_path=input_path)
            return False, metadata
            
    except subprocess.TimeoutExpired:
        error_msg = "ocrmypdf processing timed out"
        metadata["processing_errors"].append(error_msg)
        logger.error(error_msg, input_path=input_path)
        return False, metadata
    except Exception as e:
        error_msg = f"ocrmypdf processing failed: {e}"
        metadata["processing_errors"].append(error_msg)
        logger.error(error_msg, input_path=input_path, error=str(e))
        return False, metadata


def estimate_ocr_progress(current_page: int, total_pages: int) -> int:
    """
    Calculate OCR progress percentage
    """
    if total_pages == 0:
        return 0
    return min(100, int((current_page / total_pages) * 100))


async def calculate_file_hash(file_path: str) -> str:
    """
    Calculate SHA256 hash of a file for deduplication
    """
    hash_sha256 = hashlib.sha256()
    async with aiofiles.open(file_path, 'rb') as f:
        while chunk := await f.read(8192):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()