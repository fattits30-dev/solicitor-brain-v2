import os
import magic
import pytesseract
import aiofiles
from PIL import Image
from PyPDF2 import PdfReader
from typing import Optional, Dict, Any
import structlog
from io import BytesIO
from fastapi import UploadFile, HTTPException
from config import settings

logger = structlog.get_logger(__name__)


class FileService:
    def __init__(self):
        self.upload_dir = settings.upload_dir
        self.max_file_size = settings.max_file_size
        
        # Ensure upload directory exists
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_file(self, file: UploadFile) -> str:
        """Save uploaded file and return the file path."""
        try:
            # Check file size
            content = await file.read()
            if len(content) > self.max_file_size:
                raise HTTPException(status_code=413, detail="File too large")
            
            # Reset file pointer
            await file.seek(0)
            
            # Generate unique filename
            import uuid
            file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = os.path.join(self.upload_dir, unique_filename)
            
            # Save file
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            
            logger.info("File saved successfully", filename=file.filename, path=file_path)
            return file_path
        except Exception as e:
            logger.error("Failed to save file", error=str(e))
            raise HTTPException(status_code=500, detail=f"File save failed: {str(e)}")

    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file."""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PdfReader(file)
                text = ""
                
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                
                return text.strip()
        except Exception as e:
            logger.error("PDF text extraction failed", error=str(e))
            raise Exception(f"PDF text extraction failed: {str(e)}")

    def extract_text_with_ocr(self, file_path: str) -> str:
        """Extract text using OCR for image files."""
        try:
            # Check if pytesseract is properly configured
            try:
                pytesseract.get_tesseract_version()
            except pytesseract.TesseractNotFoundError:
                raise Exception("Tesseract OCR not found. Please install tesseract-ocr.")
            
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            logger.error("OCR text extraction failed", error=str(e))
            raise Exception(f"OCR text extraction failed: {str(e)}")

    def get_file_type(self, file_path: str) -> str:
        """Detect file type using python-magic."""
        try:
            mime_type = magic.from_file(file_path, mime=True)
            return mime_type
        except Exception as e:
            logger.error("File type detection failed", error=str(e))
            # Fallback to extension-based detection
            _, ext = os.path.splitext(file_path)
            return ext.lower()

    async def process_file(self, file: UploadFile) -> Dict[str, Any]:
        """Process uploaded file and extract text content."""
        try:
            # Save file
            file_path = await self.save_file(file)
            
            # Detect file type
            file_type = self.get_file_type(file_path)
            
            # Extract text based on file type
            text_content = ""
            processing_method = "unknown"
            
            if file_type == "application/pdf" or file_path.lower().endswith('.pdf'):
                text_content = self.extract_text_from_pdf(file_path)
                processing_method = "pdf"
            elif file_type.startswith("image/") or any(file_path.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.tiff', '.bmp']):
                text_content = self.extract_text_with_ocr(file_path)
                processing_method = "ocr"
            elif file_type.startswith("text/") or file_path.lower().endswith('.txt'):
                async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                    text_content = await f.read()
                processing_method = "text"
            else:
                raise HTTPException(
                    status_code=415, 
                    detail=f"Unsupported file type: {file_type}"
                )
            
            # Prepare metadata
            metadata = {
                "original_filename": file.filename,
                "file_type": file_type,
                "processing_method": processing_method,
                "file_size": os.path.getsize(file_path),
                "text_length": len(text_content)
            }
            
            logger.info("File processed successfully", 
                       filename=file.filename, 
                       method=processing_method,
                       text_length=len(text_content))
            
            return {
                "file_path": file_path,
                "content": text_content,
                "metadata": metadata
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error("File processing failed", error=str(e))
            raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")

    def cleanup_file(self, file_path: str) -> bool:
        """Remove file from storage."""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info("File cleaned up", path=file_path)
                return True
            return False
        except Exception as e:
            logger.error("File cleanup failed", error=str(e), path=file_path)
            return False


# Global service instance
file_service = FileService()