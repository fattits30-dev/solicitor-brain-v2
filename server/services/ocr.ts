import { createWorker } from 'tesseract.js';
import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { storage } from '../storage.js';
import { aiService } from './ai.js';

export interface OCRResult {
  text: string;
  confidence?: number;
  language?: string;
  pages?: number;
  processingTime: number;
}

class OCRService {
  private worker: Tesseract.Worker | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      this.isInitialized = true;
      console.log('OCR Service initialized');
    } catch (error) {
      console.error('Failed to initialize OCR service:', error);
      throw error;
    }
  }

  async processImage(filePath: string): Promise<OCRResult> {
    const startTime = Date.now();
    
    if (!this.worker) {
      await this.initialize();
    }

    try {
      const result = await this.worker!.recognize(filePath);
      
      return {
        text: result.data.text,
        confidence: result.data.confidence,
        language: result.data.language,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error}`);
    }
  }

  async processPDF(filePath: string): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      
      return {
        text: data.text,
        pages: data.numpages,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('PDF processing failed:', error);
      throw new Error(`PDF processing failed: ${error}`);
    }
  }

  async processDocument(filePath: string, mimeType: string): Promise<OCRResult> {
    const ext = path.extname(filePath).toLowerCase();
    
    // Handle PDFs
    if (mimeType === 'application/pdf' || ext === '.pdf') {
      return this.processPDF(filePath);
    }
    
    // Handle images
    const imageTypes = ['.jpg', '.jpeg', '.png', '.tiff', '.bmp'];
    if (imageTypes.includes(ext) || mimeType.startsWith('image/')) {
      return this.processImage(filePath);
    }
    
    // Handle text files directly
    if (mimeType.startsWith('text/') || ['.txt', '.md'].includes(ext)) {
      const text = await fs.readFile(filePath, 'utf-8');
      return {
        text,
        processingTime: 0
      };
    }
    
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  async processAndStore(documentId: string, filePath: string, mimeType: string): Promise<void> {
    try {
      // Process the document
      const ocrResult = await this.processDocument(filePath, mimeType);
      
      // Store the extracted text in the database
      await storage.updateDocumentOCR(documentId, {
        extractedText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        pages: ocrResult.pages,
        processingTime: ocrResult.processingTime
      });
      
      // If we have extracted text, generate embeddings for vector search
      if (ocrResult.text && ocrResult.text.trim().length > 0) {
        console.log(`Document ${documentId} processed: ${ocrResult.text.length} characters extracted`);
        
        // Generate embeddings for vector search
        try {
          await aiService.processDocumentEmbeddings(documentId, ocrResult.text);
          console.log(`Embeddings generated for document ${documentId}`);
        } catch (embeddingError) {
          console.error(`Failed to generate embeddings for document ${documentId}:`, embeddingError);
          // Don't throw - OCR was successful even if embedding failed
        }
      }
    } catch (error) {
      console.error(`Failed to process document ${documentId}:`, error);
      
      // Update document with error status
      await storage.updateDocumentOCR(documentId, {
        extractedText: null,
        ocrError: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

// Create singleton instance
export const ocrService = new OCRService();

// Initialize on module load
// Delayed initialization to prevent server startup blocking
setTimeout(() => {
  if (process.env.ENABLE_OCR === 'true') {
    ocrService.initialize().catch(console.error);
  }
}, 5000);

// Cleanup on process exit
process.on('SIGINT', async () => {
  await ocrService.cleanup();
  process.exit();
});

process.on('SIGTERM', async () => {
  await ocrService.cleanup();
  process.exit();
});