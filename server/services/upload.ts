import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import { db } from '../db.js';
import { documents } from '@shared/schema';
import type { InsertDocument, Document } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { structuredLogger, LogCategory } from './structured-logger';
import { mcpFilesystem } from './mcp-filesystem';

// Create upload directory if it doesn't exist
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    const exists = await mcpFilesystem.exists(UPLOAD_DIR);
    if (!exists) {
      await mcpFilesystem.createDirectory(UPLOAD_DIR);
    }
  } catch {
    // Fallback to native fs if MCP fails
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
  }
}

// Initialize upload directory
ensureUploadDir();

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Create case-specific subdirectory
    const caseId = req.body.caseId || 'uncategorized';
    const caseDir = path.join(UPLOAD_DIR, caseId);

    try {
      const exists = await mcpFilesystem.exists(caseDir);
      if (!exists) {
        await mcpFilesystem.createDirectory(caseDir);
      }
    } catch {
      // Fallback to native fs if MCP fails
      try {
        await fs.access(caseDir);
      } catch {
        await fs.mkdir(caseDir, { recursive: true });
      }
    }

    cb(null, caseDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random hash
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const _ext = path.extname(file.originalname).toLowerCase();
    const safeName = file.originalname.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    const filename = `${timestamp}_${randomHash}_${safeName}`;
    cb(null, filename);
  },
});

// File filter to validate uploads
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }

  // Check MIME type for additional security
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file MIME type'));
  }

  cb(null, true);
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Max 10 files per upload
  },
});

// Calculate file hash for deduplication
export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    // Use MCP filesystem for hash calculation
    return await mcpFilesystem.calculateFileHash(filePath);
  } catch {
    // Fallback to native fs
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }
}

// Save document metadata to database
export async function saveDocumentMetadata(
  file: Express.Multer.File,
  caseId: string,
  documentType: string,
  source: string,
  userId: string,
): Promise<Document> {
  const filePath = file.path;
  const hash = await calculateFileHash(filePath);

  await structuredLogger.info(
    `Processing document upload: ${file.originalname}`,
    LogCategory.DOCUMENT_UPLOAD,
    {
      userId,
      caseId,
      metadata: {
        fileName: file.originalname,
        fileSize: file.size,
        documentType,
        source,
        hash,
        operation: 'document_upload'
      }
    },
    ['document', 'upload', 'processing']
  );

  // Check for duplicate files
  const [existing] = await db.select().from(documents).where(eq(documents.hash, hash)).limit(1);

  if (existing) {
    // Remove duplicate file
    try {
      await mcpFilesystem.deleteFile(filePath);
    } catch {
      // Fallback to native fs
      await fs.unlink(filePath);
    }
    await structuredLogger.warn(
      `Duplicate file detected: ${file.originalname}`,
      LogCategory.DOCUMENT_UPLOAD,
      {
        userId,
        caseId,
        documentId: existing.id,
        metadata: {
          fileName: file.originalname,
          existingDocumentId: existing.id,
          hash,
          operation: 'duplicate_detection'
        }
      },
      ['document', 'upload', 'duplicate']
    );
    throw new Error(`Duplicate file detected. This file already exists as document ${existing.id}`);
  }

  // Save document metadata
  const documentData: InsertDocument = {
    caseId,
    fileName: file.originalname,
    filePath: filePath,
    fileSize: file.size,
    type: documentType,
    source,
    hash,
    ocrText: null, // Will be populated by OCR service later
  };

  const [newDocument] = await db.insert(documents).values(documentData).returning();

  await structuredLogger.info(
    `Document uploaded successfully: ${file.originalname}`,
    LogCategory.DOCUMENT_UPLOAD,
    {
      userId,
      caseId,
      documentId: newDocument.id,
      metadata: {
        fileName: file.originalname,
        fileSize: file.size,
        documentType,
        filePath,
        operation: 'document_save_complete'
      }
    },
    ['document', 'upload', 'success']
  );

  return newDocument;
}

// Delete document and its file
export async function deleteDocument(documentId: string): Promise<boolean> {
  const [document] = await db.select().from(documents).where(eq(documents.id, parseInt(documentId))).limit(1);

  if (!document) {
    return false;
  }

  // Delete file from filesystem
  try {
    await mcpFilesystem.deleteFile(document.filePath);
    await structuredLogger.info(
      'File deleted successfully from filesystem via MCP',
      LogCategory.FILE_MANAGEMENT,
      {
        documentId,
        metadata: {
          filePath: document.filePath,
          operation: 'file_delete',
          method: 'mcp'
        }
      },
      ['file', 'delete', 'success', 'mcp']
    );
  } catch {
    // Try fallback to native fs
    try {
      await fs.unlink(document.filePath);
      await structuredLogger.info(
        'File deleted successfully from filesystem via fallback',
        LogCategory.FILE_MANAGEMENT,
        {
          documentId,
          metadata: {
            filePath: document.filePath,
            operation: 'file_delete',
            method: 'fallback'
          }
        },
        ['file', 'delete', 'success', 'fallback']
      );
    } catch (fallbackError) {
      await structuredLogger.error(
        `Failed to delete file from filesystem: ${document.filePath}`,
        LogCategory.FILE_MANAGEMENT,
        fallbackError as Error,
        {
          documentId,
          metadata: {
            filePath: document.filePath,
            operation: 'file_delete'
          }
        },
        ['file', 'delete', 'failed']
      );
    }
  }

  // Delete from database
  await db.delete(documents).where(eq(documents.id, parseInt(documentId)));

  return true;
}

// Get document file
export async function getDocumentFile(
  documentId: string,
): Promise<{ path: string; mimetype: string } | null> {
  const [document] = await db.select().from(documents).where(eq(documents.id, parseInt(documentId))).limit(1);

  if (!document) {
    return null;
  }

  // Verify file exists
  try {
    const exists = await mcpFilesystem.exists(document.filePath);
    if (!exists) {
      return null;
    }
  } catch {
    // Fallback to native fs
    try {
      await fs.access(document.filePath);
    } catch {
      return null;
    }
  }

  // Determine MIME type from extension
  const _ext = path.extname(document.filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };

  return {
    path: document.filePath,
    mimetype: mimeTypes[_ext] || 'application/octet-stream',
  };
}

// Clean orphaned files (files without database records)
export async function cleanOrphanedFiles(): Promise<number> {
  await structuredLogger.info(
    'Starting orphaned files cleanup',
    LogCategory.FILE_MANAGEMENT,
    {
      metadata: {
        uploadDir: UPLOAD_DIR,
        operation: 'cleanup_start'
      }
    },
    ['file', 'cleanup', 'start']
  );
  
  let cleanedCount = 0;

  async function scanDirectory(dir: string) {
    try {
      const entries = await mcpFilesystem.listDirectory(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.type === 'directory') {
          await scanDirectory(fullPath);
        } else if (entry.type === 'file') {
          // Check if file exists in database
          const [document] = await db
            .select()
            .from(documents)
            .where(eq(documents.filePath, fullPath))
            .limit(1);

          if (!document) {
            // Orphaned file, delete it
            try {
              await mcpFilesystem.deleteFile(fullPath);
              cleanedCount++;
              await structuredLogger.info(
                `Deleted orphaned file: ${fullPath}`,
                LogCategory.FILE_MANAGEMENT,
                {
                  metadata: {
                    filePath: fullPath,
                    operation: 'orphaned_file_cleanup',
                    totalCleaned: cleanedCount
                  }
                },
                ['file', 'cleanup', 'orphaned']
              );
            } catch {
              // Try fallback
              try {
                await fs.unlink(fullPath);
                cleanedCount++;
              } catch (fallbackError) {
                await structuredLogger.error(
                  `Failed to delete orphaned file: ${fullPath}`,
                  LogCategory.FILE_MANAGEMENT,
                  fallbackError as Error,
                  {
                    metadata: {
                      filePath: fullPath,
                      operation: 'orphaned_file_cleanup'
                    }
                  },
                  ['file', 'cleanup', 'failed']
                );
              }
            }
          }
        }
      }
    } catch {
      // Fallback to native fs for directory listing
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          // Check if file exists in database
          const [document] = await db
            .select()
            .from(documents)
            .where(eq(documents.filePath, fullPath))
            .limit(1);

          if (!document) {
            // Orphaned file, delete it
            try {
              await fs.unlink(fullPath);
              cleanedCount++;
              await structuredLogger.info(
                `Deleted orphaned file: ${fullPath}`,
                LogCategory.FILE_MANAGEMENT,
                {
                  metadata: {
                    filePath: fullPath,
                    operation: 'orphaned_file_cleanup',
                    totalCleaned: cleanedCount,
                    method: 'fallback'
                  }
                },
                ['file', 'cleanup', 'orphaned', 'fallback']
              );
            } catch (error) {
              await structuredLogger.error(
                `Failed to delete orphaned file (fallback): ${fullPath}`,
                LogCategory.FILE_MANAGEMENT,
                error as Error,
                {
                  metadata: {
                    filePath: fullPath,
                    operation: 'orphaned_file_cleanup'
                  }
                },
                ['file', 'cleanup', 'failed', 'fallback']
              );
            }
          }
        }
      }
    }
  }

  await scanDirectory(UPLOAD_DIR);
  
  await structuredLogger.info(
    `Orphaned files cleanup completed: ${cleanedCount} files removed`,
    LogCategory.FILE_MANAGEMENT,
    {
      metadata: {
        uploadDir: UPLOAD_DIR,
        cleanedCount,
        operation: 'cleanup_complete'
      }
    },
    ['file', 'cleanup', 'complete']
  );
  
  return cleanedCount;
}

// Export types
export type { Document } from '@shared/schema';
