import { useState, useEffect, useCallback, useRef } from 'react';
import type { Document, UploadFile } from './types';

// Helper function to get authenticated headers
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Hook for managing document list
export const useDocuments = (caseId?: string) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const url = caseId ? `/api/cases/${caseId}/documents` : '/api/documents';
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load documents: ${response.status}`);
      }
      
      const data = await response.json();
      setDocuments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const addDocument = useCallback((document: Document) => {
    setDocuments(prev => [document, ...prev]);
  }, []);

  const updateDocument = useCallback((documentId: string, updates: Partial<Document>) => {
    setDocuments(prev => 
      prev.map(doc => doc.id === documentId ? { ...doc, ...updates } : doc)
    );
  }, []);

  const removeDocument = useCallback((documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return {
    documents,
    loading,
    error,
    loadDocuments,
    addDocument,
    updateDocument,
    removeDocument
  };
};

// Hook for managing document metadata
export const useDocumentMetadata = (documentId: string) => {
  const [metadata, setMetadata] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetadata = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/documents/${documentId}/metadata`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to load metadata: ${response.status}`);
      }
      
      const data = await response.json();
      setMetadata(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  const updateMetadata = useCallback(async (updates: Partial<Document>) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/metadata`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update metadata');
      }
      
      const updatedMetadata = await response.json();
      setMetadata(updatedMetadata);
      return updatedMetadata;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [documentId]);

  useEffect(() => {
    if (documentId) {
      loadMetadata();
    }
  }, [loadMetadata, documentId]);

  return {
    metadata,
    loading,
    error,
    loadMetadata,
    updateMetadata
  };
};

// Hook for managing document uploads
export const useDocumentUpload = () => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((newFiles: File[], defaultType: string = 'other') => {
    const uploadFiles: UploadFile[] = newFiles.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      file,
      type: detectDocumentType(file.name) || defaultType,
      progress: 0,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...uploadFiles]);
    return uploadFiles;
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const updateFile = useCallback((fileId: string, updates: Partial<UploadFile>) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, ...updates } : f));
  }, []);

  const uploadFiles = useCallback(async (
    caseId?: string, 
    options: {
      source?: string;
      description?: string;
      priority?: string;
      enableOCR?: boolean;
    } = {}
  ) => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    const uploadPromises = pendingFiles.map(async (uploadFile) => {
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      
      if (caseId) formData.append('caseId', caseId);
      formData.append('documentType', uploadFile.type);
      if (options.source) formData.append('source', options.source);
      if (options.description) formData.append('description', options.description);
      if (options.priority) formData.append('priority', options.priority);

      try {
        updateFile(uploadFile.id, { status: 'uploading' });

        // Get auth token for upload
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {};
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/upload/document', {
          method: 'POST',
          headers,
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Upload failed');
        }

        const result = await response.json();
        
        updateFile(uploadFile.id, {
          status: 'processing',
          progress: 100,
          documentId: result.document.id,
          ocrStatus: options.enableOCR ? 'processing' : 'pending',
          ocrProgress: 0
        });

        // Poll for OCR status if enabled
        if (options.enableOCR && result.document.id) {
          pollOCRStatus(uploadFile.id, result.document.id);
        } else {
          updateFile(uploadFile.id, { status: 'completed' });
        }

        return result.document;
      } catch (error: any) {
        updateFile(uploadFile.id, {
          status: 'failed',
          error: error.message
        });
        throw error;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      setIsUploading(false);
      return results;
    } catch (error: any) {
      setError('Some uploads failed. Please check individual file statuses.');
      setIsUploading(false);
      throw error;
    }
  }, [files, updateFile]);

  const pollOCRStatus = useCallback(async (fileId: string, documentId: string) => {
    const maxAttempts = 30; // 5 minutes at 10 second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/ocr-status`);
        if (!response.ok) return;

        const { status, progress } = await response.json();
        
        updateFile(fileId, {
          ocrStatus: status,
          ocrProgress: progress || 0
        });

        if (status === 'completed' || status === 'failed') {
          updateFile(fileId, { status: 'completed' });
          return;
        }

        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          updateFile(fileId, {
            status: 'completed',
            ocrStatus: 'failed',
            error: 'OCR timeout'
          });
        }
      } catch (error) {
        console.error('OCR polling error:', error);
        updateFile(fileId, {
          status: 'completed',
          ocrStatus: 'failed',
          error: 'OCR monitoring failed'
        });
      }
    };

    // Start polling after initial delay
    setTimeout(poll, 5000);
  }, [updateFile]);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  const retryFailedUploads = useCallback(() => {
    setFiles(prev => 
      prev.map(f => f.status === 'failed' ? { ...f, status: 'pending', error: undefined } : f)
    );
  }, []);

  return {
    files,
    isUploading,
    error,
    addFiles,
    removeFile,
    updateFile,
    uploadFiles,
    clearFiles,
    retryFailedUploads,
    canUpload: files.length > 0 && !isUploading && files.some(f => f.status === 'pending'),
    hasFailedUploads: files.some(f => f.status === 'failed'),
    allCompleted: files.length > 0 && files.every(f => f.status === 'completed')
  };
};

// Hook for managing OCR processing
export const useOCRStatus = (documentId?: string) => {
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending');
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState<string>('');
  const [entities, setEntities] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pollStatusRef = useRef<NodeJS.Timeout>();

  const startOCRProcessing = useCallback(async () => {
    if (!documentId) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/ocr`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to start OCR processing');
      }

      setStatus('processing');
      setProgress(0);
      setError(null);

      // Start polling for status
      pollStatusRef.current = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/documents/${documentId}/ocr-status`);
          if (statusResponse.ok) {
            const { status: newStatus, progress: newProgress, text: newText, entities: newEntities } = await statusResponse.json();
            
            setStatus(newStatus);
            setProgress(newProgress || 0);
            
            if (newStatus === 'completed') {
              setText(newText || '');
              setEntities(newEntities || []);
              if (pollStatusRef.current) {
                clearInterval(pollStatusRef.current);
              }
            } else if (newStatus === 'failed') {
              setError('OCR processing failed');
              if (pollStatusRef.current) {
                clearInterval(pollStatusRef.current);
              }
            }
          }
        } catch (error) {
          console.error('Error polling OCR status:', error);
        }
      }, 2000);

    } catch (err: any) {
      setError(err.message);
      setStatus('failed');
    }
  }, [documentId]);

  const loadOCRData = useCallback(async () => {
    if (!documentId) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/ocr-status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
        setProgress(data.progress || 0);
        setText(data.text || '');
        setEntities(data.entities || []);

        // If processing, start polling
        if (data.status === 'processing') {
          startOCRProcessing();
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [documentId, startOCRProcessing]);

  useEffect(() => {
    if (documentId) {
      loadOCRData();
    }

    return () => {
      if (pollStatusRef.current) {
        clearInterval(pollStatusRef.current);
      }
    };
  }, [documentId, loadOCRData]);

  return {
    status,
    progress,
    text,
    entities,
    error,
    startOCRProcessing,
    loadOCRData,
    isProcessing: status === 'processing',
    isCompleted: status === 'completed',
    hasFailed: status === 'failed'
  };
};

// Utility function for detecting document type
const detectDocumentType = (filename: string): string => {
  const name = filename.toLowerCase();
  
  if (name.includes('contract') || name.includes('agreement')) return 'contract';
  if (name.includes('letter') || name.includes('email') || name.includes('correspondence')) return 'correspondence';
  if (name.includes('invoice') || name.includes('bill') || name.includes('receipt')) return 'invoice';
  if (name.includes('statement') || name.includes('account')) return 'statement';
  if (name.includes('report') || name.includes('analysis')) return 'report';
  if (name.includes('court') || name.includes('filing') || name.includes('motion')) return 'court-filing';
  if (name.match(/\.(jpg|jpeg|png|gif)$/)) return 'photo';
  
  return 'other';
};