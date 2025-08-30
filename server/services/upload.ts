import multer from "multer";
import path from "path";
import crypto from "crypto";
import { promises as fs } from "fs";
import { db } from "../db.js";
import { documents } from "@shared/schema";
import type { InsertDocument, Document } from "@shared/schema";
import { eq } from "drizzle-orm";

// Create upload directory if it doesn't exist
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
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
      await fs.access(caseDir);
    } catch {
      await fs.mkdir(caseDir, { recursive: true });
    }
    
    cb(null, caseDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random hash
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = file.originalname
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 50);
    const filename = `${timestamp}_${randomHash}_${safeName}`;
    cb(null, filename);
  }
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
    'image/jpg'
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
    files: 10 // Max 10 files per upload
  }
});

// Calculate file hash for deduplication
export async function calculateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// Save document metadata to database
export async function saveDocumentMetadata(
  file: Express.Multer.File,
  caseId: string,
  documentType: string,
  source: string,
  userId: string
): Promise<Document> {
  const filePath = file.path;
  const hash = await calculateFileHash(filePath);
  
  // Check for duplicate files
  const [existing] = await db
    .select()
    .from(documents)
    .where(eq(documents.hash, hash))
    .limit(1);
  
  if (existing) {
    // Remove duplicate file
    await fs.unlink(filePath);
    throw new Error(`Duplicate file detected. This file already exists as document ${existing.id}`);
  }
  
  // Save document metadata
  const documentData: InsertDocument = {
    caseId,
    type: documentType,
    source,
    path: filePath,
    hash,
    ocrText: null // Will be populated by OCR service later
  };
  
  const [newDocument] = await db
    .insert(documents)
    .values(documentData)
    .returning();
  
  return newDocument;
}

// Delete document and its file
export async function deleteDocument(documentId: string): Promise<boolean> {
  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  
  if (!document) {
    return false;
  }
  
  // Delete file from filesystem
  try {
    await fs.unlink(document.path);
  } catch (error) {
    console.error(`Failed to delete file ${document.path}:`, error);
  }
  
  // Delete from database
  await db.delete(documents).where(eq(documents.id, documentId));
  
  return true;
}

// Get document file
export async function getDocumentFile(documentId: string): Promise<{ path: string; mimetype: string } | null> {
  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  
  if (!document) {
    return null;
  }
  
  // Verify file exists
  try {
    await fs.access(document.path);
  } catch {
    return null;
  }
  
  // Determine MIME type from extension
  const ext = path.extname(document.path).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  };
  
  return {
    path: document.path,
    mimetype: mimeTypes[ext] || 'application/octet-stream'
  };
}

// Clean orphaned files (files without database records)
export async function cleanOrphanedFiles(): Promise<number> {
  let cleanedCount = 0;
  
  async function scanDirectory(dir: string) {
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
          .where(eq(documents.path, fullPath))
          .limit(1);
        
        if (!document) {
          // Orphaned file, delete it
          try {
            await fs.unlink(fullPath);
            cleanedCount++;
            console.log(`Deleted orphaned file: ${fullPath}`);
          } catch (error) {
            console.error(`Failed to delete orphaned file ${fullPath}:`, error);
          }
        }
      }
    }
  }
  
  await scanDirectory(UPLOAD_DIR);
  return cleanedCount;
}

// Export types
export type { Document } from "@shared/schema";