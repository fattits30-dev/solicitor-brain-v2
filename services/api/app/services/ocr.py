"""
OCR service for document text extraction
"""

import os
import tempfile
from typing import Optional
import aiofiles
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
import PyPDF2
import io


async def process_document_ocr(file_path: str, mime_type: str) -> str:
    """
    Extract text from document using OCR or direct text extraction
    """
    
    if mime_type == "application/pdf":
        return await process_pdf(file_path)
    elif mime_type.startswith("image/"):
        return await process_image(file_path)
    elif mime_type in ["text/plain", "text/html", "text/markdown"]:
        return await process_text_file(file_path)
    else:
        raise ValueError(f"Unsupported file type: {mime_type}")


async def process_pdf(file_path: str) -> str:
    """
    Process PDF file - try text extraction first, fall back to OCR
    """
    text_content = []
    
    # Try direct text extraction first
    try:
        async with aiofiles.open(file_path, 'rb') as file:
            pdf_bytes = await file.read()
            pdf_file = io.BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                if text.strip():
                    text_content.append(f"--- Page {page_num + 1} ---\n{text}")
            
            # If we got text, return it
            if text_content:
                return "\n\n".join(text_content)
    except Exception as e:
        print(f"Direct PDF text extraction failed: {e}")
    
    # Fall back to OCR
    return await ocr_pdf(file_path)


async def ocr_pdf(file_path: str) -> str:
    """
    OCR a PDF file by converting pages to images
    """
    text_content = []
    
    # Convert PDF to images
    with tempfile.TemporaryDirectory() as temp_dir:
        images = convert_from_path(
            file_path,
            dpi=300,
            output_folder=temp_dir,
            fmt='png',
            thread_count=4
        )
        
        for i, image in enumerate(images):
            # Perform OCR on each page
            text = pytesseract.image_to_string(
                image,
                lang='eng',
                config='--psm 1 --oem 3'  # Page segmentation mode 1, OCR engine mode 3
            )
            
            if text.strip():
                text_content.append(f"--- Page {i + 1} ---\n{text}")
    
    return "\n\n".join(text_content)


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


def estimate_ocr_progress(current_page: int, total_pages: int) -> int:
    """
    Calculate OCR progress percentage
    """
    if total_pages == 0:
        return 0
    return min(100, int((current_page / total_pages) * 100))