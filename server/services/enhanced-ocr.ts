import { createWorker, Worker } from 'tesseract.js';
import pdf2pic from 'pdf2pic';
import fs from 'fs/promises';
import path from 'path';
// import crypto from 'crypto';
import { EventEmitter } from 'events';
import { aiService } from './ai.js';
import { mcpFilesystem } from './mcp-filesystem';

export interface OCRProgress {
  documentId: string;
  stage: 'preprocessing' | 'ocr' | 'postprocessing' | 'embedding' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  pageNumber?: number;
  totalPages?: number;
}

export interface OCRResult {
  documentId: string;
  text: string;
  confidence: number;
  pages: number;
  processingTime: number;
  metadata: {
    language?: string;
    documentType?: string;
    quality: 'high' | 'medium' | 'low';
    extractionMethod: 'native' | 'ocr' | 'hybrid';
    legalEntities?: {
      caseNumbers?: string[];
      parties?: string[];
      dates?: string[];
      references?: string[];
    };
  };
  chunks?: {
    text: string;
    pageNumber: number;
    confidence: number;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];
  processingLog: string[];
}

export interface ProcessingOptions {
  enhanceImage?: boolean;
  detectLanguage?: boolean;
  extractLegalEntities?: boolean;
  generateChunks?: boolean;
  generateEmbeddings?: boolean;
  retryFailedPages?: boolean;
  maxRetries?: number;
}

class EnhancedOCRService extends EventEmitter {
  private workers: Map<string, Worker> = new Map();
  private processingQueue: string[] = [];
  private isProcessing = false;
  private maxConcurrentJobs = 2;
  private activeJobs = 0;

  constructor() {
    super();
    this.setMaxListeners(50); // Handle many document processing events
  }

  private async initializeWorker(workerId: string): Promise<Worker> {
    try {
      const worker = await createWorker('eng+fra+deu', 1, {
        logger: (m) => {
          this.emit('ocr-progress', {
            workerId,
            status: m.status,
            progress: m.progress || 0,
          });
        },
      });

      // Configure Tesseract for legal documents
      await worker.setParameters({
        tessedit_page_text_mode: '1', // Sparse text mode for better accuracy
        tessedit_ocr_engine_mode: '1', // LSTM OCR engine
        tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });

      this.workers.set(workerId, worker);
      return worker;
    } catch (error) {
      throw new Error(`Failed to initialize OCR worker: ${error}`);
    }
  }

  private async getOrCreateWorker(_workerId?: string): Promise<Worker> {
    const id = _workerId || `worker_${Date.now()}`;

    if (this.workers.has(id)) {
      return this.workers.get(id)!;
    }

    return await this.initializeWorker(id);
  }

  private async preprocessImage(imagePath: string): Promise<string> {
    // For now, return the original path
    // In production, you'd implement image enhancement here:
    // - Deskewing
    // - Noise reduction
    // - Contrast enhancement
    // - Resolution optimization
    return imagePath;
  }

  private async detectDocumentType(text: string): Promise<string> {
    const textLower = text.toLowerCase();

    // Legal document patterns
    const patterns = [
      {
        type: 'contract',
        keywords: ['agreement', 'contract', 'party', 'whereas', 'consideration'],
      },
      { type: 'correspondence', keywords: ['dear', 'sincerely', 'yours faithfully', 'letter'] },
      { type: 'court_filing', keywords: ['claimant', 'defendant', 'court', 'claim', 'hearing'] },
      {
        type: 'evidence',
        keywords: ['exhibit', 'evidence', 'witness', 'statement', 'declaration'],
      },
      { type: 'invoice', keywords: ['invoice', 'bill', 'payment', 'amount', 'vat'] },
      { type: 'legal_opinion', keywords: ['opinion', 'advice', 'recommendation', 'analysis'] },
    ];

    for (const pattern of patterns) {
      const matches = pattern.keywords.filter((keyword) => textLower.includes(keyword));
      if (matches.length >= 2) {
        return pattern.type;
      }
    }

    return 'general';
  }

  private extractLegalEntities(text: string): {
    caseNumbers?: string[];
    parties?: string[];
    dates?: string[];
    references?: string[];
  } {
    const entities: any = {};

    // UK case number patterns
    const caseNumberRegex = /(?:\[|\()?(?:20\d{2})\]?\s*(?:EWHC|EWCA|UKSC|Ch|QB|Fam)\s*\d+/gi;
    entities.caseNumbers = text.match(caseNumberRegex) || [];

    // Date patterns
    const dateRegex =
      /\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi;
    entities.dates = text.match(dateRegex) || [];

    // Legal references (simplified)
    const referenceRegex = /(?:s\.|section)\s*\d+(?:\(\d+\))?(?:\([a-z]\))?/gi;
    entities.references = text.match(referenceRegex) || [];

    // Extract potential party names (capitalized words/phrases near legal keywords)
    const partyContext =
      /(?:claimant|defendant|appellant|respondent|plaintiff)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi;
    const partyMatches = [...text.matchAll(partyContext)];
    entities.parties = partyMatches.map((match) => match[1]) || [];

    return entities;
  }

  private calculateQuality(confidence: number, textLength: number): 'high' | 'medium' | 'low' {
    if (confidence > 85 && textLength > 1000) return 'high';
    if (confidence > 70 && textLength > 500) return 'medium';
    return 'low';
  }

  async processDocument(
    documentId: string,
    filePath: string,
    mimeType: string,
    options: ProcessingOptions = {},
  ): Promise<OCRResult> {
    const _startTime = Date.now();
    const processingLog: string[] = [];

    try {
      processingLog.push(`Starting OCR processing for ${documentId}`);

      this.emit('progress', {
        documentId,
        stage: 'preprocessing',
        progress: 0,
        message: 'Starting document processing',
      } as OCRProgress);

      const result: OCRResult = {
        documentId,
        text: '',
        confidence: 0,
        pages: 0,
        processingTime: 0,
        metadata: {
          quality: 'low',
          extractionMethod: 'ocr',
        },
        processingLog,
      };

      // Handle different file types
      if (mimeType === 'application/pdf' || path.extname(filePath).toLowerCase() === '.pdf') {
        return await this.processPDF(documentId, filePath, options, result);
      } else if (mimeType.startsWith('image/')) {
        return await this.processImage(documentId, filePath, options, result);
      } else if (mimeType.startsWith('text/')) {
        return await this.processTextFile(documentId, filePath, result);
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      processingLog.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      this.emit('progress', {
        documentId,
        stage: 'error',
        progress: 0,
        message: `Processing failed: ${error}`,
      } as OCRProgress);

      throw error;
    }
  }

  private async processPDF(
    documentId: string,
    filePath: string,
    options: ProcessingOptions,
    result: OCRResult,
  ): Promise<OCRResult> {
    const { processingLog } = result;

    try {
      // Try native PDF text extraction first
      processingLog.push('Attempting native PDF text extraction');

      const pdfParse = await import('pdf-parse');
      let dataBuffer: Buffer;
      try {
        // Try to read using MCP filesystem first
        const content = await mcpFilesystem.readTextFile(filePath);
        dataBuffer = Buffer.from(content, 'utf-8');
      } catch {
        // Fallback to native fs for binary read
        dataBuffer = await fs.readFile(filePath);
      }
      const pdfData = await pdfParse.default(dataBuffer);

      if (pdfData.text && pdfData.text.trim().length > 100) {
        processingLog.push(`Native extraction successful: ${pdfData.text.length} characters`);

        result.text = pdfData.text;
        result.confidence = 99; // Native extraction is highly reliable
        result.pages = pdfData.numpages;
        result.metadata.extractionMethod = 'native';

        return await this.postProcessText(documentId, result, options);
      }
    } catch (error) {
      processingLog.push(`Native extraction failed: ${error}, falling back to OCR`);
    }

    // Fall back to OCR processing
    return await this.processPDFWithOCR(documentId, filePath, options, result);
  }

  private async processPDFWithOCR(
    documentId: string,
    filePath: string,
    options: ProcessingOptions,
    result: OCRResult,
  ): Promise<OCRResult> {
    const { processingLog } = result;

    this.emit('progress', {
      documentId,
      stage: 'ocr',
      progress: 10,
      message: 'Converting PDF to images for OCR',
    } as OCRProgress);

    // Convert PDF pages to images
    const pdf2picOptions = {
      density: 300,
      saveFilename: 'page',
      savePath: path.dirname(filePath),
      format: 'png',
      width: 2480,
      height: 3508,
    };

    const convert = pdf2pic.fromPath(filePath, pdf2picOptions);
    const pages = await convert.bulk(-1); // Convert all pages

    result.pages = pages.length;
    processingLog.push(`Converted PDF to ${pages.length} images`);

    // Process each page with OCR
    const worker = await this.getOrCreateWorker(`${documentId}_worker`);
    const pageTexts: string[] = [];
    const chunks: any[] = [];
    let totalConfidence = 0;

    for (let i = 0; i < pages.length; i++) {
      const pageImage = pages[i];

      this.emit('progress', {
        documentId,
        stage: 'ocr',
        progress: 20 + (i / pages.length) * 60,
        message: `Processing page ${i + 1} of ${pages.length}`,
        pageNumber: i + 1,
        totalPages: pages.length,
      } as OCRProgress);

      try {
        // Preprocess image if requested
        const imagePath = options.enhanceImage
          ? await this.preprocessImage(pageImage.path)
          : pageImage.path;

        const ocrResult = await worker.recognize(imagePath);

        if (ocrResult.data.text.trim()) {
          pageTexts.push(ocrResult.data.text);
          totalConfidence += ocrResult.data.confidence || 0;

          if (options.generateChunks) {
            chunks.push({
              text: ocrResult.data.text,
              pageNumber: i + 1,
              confidence: ocrResult.data.confidence || 0,
            });
          }
        }

        // Clean up temporary image
        try {
          await mcpFilesystem.deleteFile(pageImage.path);
        } catch {
          // Fallback to native fs
          await fs.unlink(pageImage.path).catch(() => {});
        }

        processingLog.push(
          `Page ${i + 1}: ${ocrResult.data.text.length} chars, confidence: ${ocrResult.data.confidence}`,
        );
      } catch (error) {
        processingLog.push(`Page ${i + 1} failed: ${error}`);

        if (options.retryFailedPages) {
          // Retry logic would go here
        }
      }
    }

    result.text = pageTexts.join('\n\n');
    result.confidence = totalConfidence / pages.length;
    result.chunks = chunks;
    result.metadata.extractionMethod = 'ocr';

    await this.cleanupWorker(`${documentId}_worker`);

    return await this.postProcessText(documentId, result, options);
  }

  private async processImage(
    documentId: string,
    filePath: string,
    options: ProcessingOptions,
    result: OCRResult,
  ): Promise<OCRResult> {
    this.emit('progress', {
      documentId,
      stage: 'ocr',
      progress: 20,
      message: 'Processing image with OCR',
    } as OCRProgress);

    const worker = await this.getOrCreateWorker(`${documentId}_worker`);

    try {
      const imagePath = options.enhanceImage ? await this.preprocessImage(filePath) : filePath;

      const ocrResult = await worker.recognize(imagePath);

      result.text = ocrResult.data.text;
      result.confidence = ocrResult.data.confidence || 0;
      result.pages = 1;
      result.metadata.extractionMethod = 'ocr';

      await this.cleanupWorker(`${documentId}_worker`);

      return await this.postProcessText(documentId, result, options);
    } catch (error) {
      await this.cleanupWorker(`${documentId}_worker`);
      throw error;
    }
  }

  private async processTextFile(
    documentId: string,
    filePath: string,
    result: OCRResult,
  ): Promise<OCRResult> {
    let text: string;
    try {
      text = await mcpFilesystem.readTextFile(filePath);
      result.processingLog.push(`Text file loaded via MCP: ${text.length} characters`);
    } catch {
      // Fallback to native fs
      text = await fs.readFile(filePath, 'utf-8');
      result.processingLog.push(`Text file loaded via fallback: ${text.length} characters`);
    }

    result.text = text;
    result.confidence = 100;
    result.pages = 1;
    result.metadata.extractionMethod = 'native';

    return await this.postProcessText(documentId, result, {});
  }

  private async postProcessText(
    documentId: string,
    result: OCRResult,
    options: ProcessingOptions,
  ): Promise<OCRResult> {
    this.emit('progress', {
      documentId,
      stage: 'postprocessing',
      progress: 85,
      message: 'Analyzing document content',
    } as OCRProgress);

    // Text cleaning and normalization
    result.text = result.text
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .replace(/[^\x20-\x7E\n\r]/g, ''); // Remove non-printable characters

    // Document analysis
    if (options.detectLanguage) {
      // Language detection would go here
      result.metadata.language = 'en';
    }

    result.metadata.documentType = await this.detectDocumentType(result.text);
    result.metadata.quality = this.calculateQuality(result.confidence, result.text.length);

    if (options.extractLegalEntities) {
      result.metadata.legalEntities = this.extractLegalEntities(result.text);
    }

    // Generate embeddings if requested
    if (options.generateEmbeddings && result.text.length > 100) {
      this.emit('progress', {
        documentId,
        stage: 'embedding',
        progress: 95,
        message: 'Generating embeddings',
      } as OCRProgress);

      try {
        await aiService.processDocumentEmbeddings(documentId, result.text);
        result.processingLog.push('Embeddings generated successfully');
      } catch (error) {
        result.processingLog.push(`Embedding generation failed: ${error}`);
      }
    }

    result.processingTime = Date.now() - Date.parse(result.processingLog[0].split(' ')[0]);

    this.emit('progress', {
      documentId,
      stage: 'completed',
      progress: 100,
      message: 'Document processing completed successfully',
    } as OCRProgress);

    return result;
  }

  private async cleanupWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.terminate();
      this.workers.delete(workerId);
    }
  }

  async processDocumentAsync(
    documentId: string,
    _filePath: string,
    _mimeType: string,
    _options: ProcessingOptions = {},
  ): Promise<void> {
    // Add to processing queue
    this.processingQueue.push(documentId);

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }

    // The actual processing will happen asynchronously
    // Results will be emitted via events and stored in database
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.activeJobs >= this.maxConcurrentJobs) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0 && this.activeJobs < this.maxConcurrentJobs) {
      const documentId = this.processingQueue.shift();
      if (documentId) {
        this.activeJobs++;

        // Process document in background
        this.processDocumentInBackground(documentId).finally(() => {
          this.activeJobs--;
          // Continue processing queue
          if (this.processingQueue.length > 0) {
            this.processQueue();
          } else {
            this.isProcessing = false;
          }
        });
      }
    }
  }

  private async processDocumentInBackground(documentId: string): Promise<void> {
    try {
      // This would load document info from database and process it
      // For now, this is a placeholder for the background processing logic
      this.emit('document-processed', { documentId, success: true });
    } catch (error) {
      this.emit('document-processed', { documentId, success: false, error });
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup all workers
    for (const [_workerId, worker] of this.workers.entries()) {
      await worker.terminate();
    }
    this.workers.clear();
    this.removeAllListeners();
  }

  getProcessingStatus(): {
    isProcessing: boolean;
    queueLength: number;
    activeJobs: number;
    maxConcurrentJobs: number;
  } {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length,
      activeJobs: this.activeJobs,
      maxConcurrentJobs: this.maxConcurrentJobs,
    };
  }
}

// Create singleton instance
export const enhancedOCRService = new EnhancedOCRService();

// Cleanup on process exit
process.on('SIGINT', async () => {
  await enhancedOCRService.cleanup();
  process.exit();
});

process.on('SIGTERM', async () => {
  await enhancedOCRService.cleanup();
  process.exit();
});
