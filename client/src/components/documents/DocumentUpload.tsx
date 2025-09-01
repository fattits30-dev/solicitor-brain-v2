import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  CheckCircle,
  Cloud,
  FileImage,
  FileText,
  FileType,
  HardDrive,
  Loader2,
  RotateCcw,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

interface UploadFile {
  id: string;
  file: File;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  documentId?: string;
  ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  ocrProgress?: number;
}

interface DocumentUploadProps {
  caseId?: string;
  onUploadComplete?: (documents: any[]) => void;
  onClose?: () => void;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  autoOCR?: boolean;
  showMetadataForm?: boolean;
}

const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Contract', icon: FileText },
  { value: 'correspondence', label: 'Correspondence', icon: FileText },
  { value: 'evidence', label: 'Evidence', icon: FileImage },
  { value: 'court-filing', label: 'Court Filing', icon: FileText },
  { value: 'invoice', label: 'Invoice', icon: FileText },
  { value: 'statement', label: 'Statement', icon: FileText },
  { value: 'report', label: 'Report', icon: FileText },
  { value: 'photo', label: 'Photo/Image', icon: FileImage },
  { value: 'other', label: 'Other', icon: FileType },
];

const UPLOAD_SOURCES = [
  { value: 'manual', label: 'Manual Upload', icon: Upload },
  { value: 'email', label: 'Email Import', icon: Cloud },
  { value: 'scan', label: 'Document Scan', icon: FileImage },
  { value: 'external', label: 'External System', icon: HardDrive },
];

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  caseId,
  onUploadComplete,
  onClose,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.gif'],
  autoOCR = true,
  showMetadataForm = true,
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [defaultType, setDefaultType] = useState('other');
  const [defaultSource, setDefaultSource] = useState('manual');
  const [description, setDescription] = useState('');
  const [enableOCR, setEnableOCR] = useState(autoOCR);
  const [priority, setPriority] = useState('normal');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileSelection(droppedFiles);
  }, []);

  const handleFileSelection = (selectedFiles: File[]) => {
    setError(null);

    // Validate file count
    if (files.length + selectedFiles.length > maxFiles) {
      setError(
        `Maximum ${maxFiles} files allowed. You can upload ${maxFiles - files.length} more files.`,
      );
      return;
    }

    // Validate and process files
    const newFiles: UploadFile[] = [];
    const errors: string[] = [];

    selectedFiles.forEach((file, index) => {
      // Check file size
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: File too large (max ${formatFileSize(maxFileSize)})`);
        return;
      }

      // Check file type
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (allowedTypes.length > 0 && !allowedTypes.includes(fileExtension)) {
        errors.push(`${file.name}: File type not allowed`);
        return;
      }

      // Detect document type based on filename/content
      const detectedType = detectDocumentType(file.name);

      newFiles.push({
        id: `file-${Date.now()}-${index}`,
        file,
        type: detectedType || defaultType,
        progress: 0,
        status: 'pending',
      });
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const detectDocumentType = (filename: string): string => {
    const name = filename.toLowerCase();

    if (name.includes('contract') || name.includes('agreement')) return 'contract';
    if (name.includes('letter') || name.includes('email') || name.includes('correspondence'))
      return 'correspondence';
    if (name.includes('invoice') || name.includes('bill') || name.includes('receipt'))
      return 'invoice';
    if (name.includes('statement') || name.includes('account')) return 'statement';
    if (name.includes('report') || name.includes('analysis')) return 'report';
    if (name.includes('court') || name.includes('filing') || name.includes('motion'))
      return 'court-filing';
    if (name.match(/\.(jpg|jpeg|png|gif)$/)) return 'photo';

    return 'other';
  };

  const updateFile = (id: string, updates: Partial<UploadFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadFile = async (uploadFile: UploadFile): Promise<void> => {
    const formData = new FormData();
    formData.append('file', uploadFile.file);

    if (caseId) formData.append('caseId', caseId);
    formData.append('documentType', uploadFile.type);
    formData.append('source', defaultSource);
    if (description) formData.append('description', description);
    if (priority) formData.append('priority', priority);

    try {
      updateFile(uploadFile.id, { status: 'uploading' });

      const response = await fetch('/api/upload/document', {
        method: 'POST',
        body: formData,
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
        ocrStatus: enableOCR ? 'processing' : 'pending',
        ocrProgress: 0,
      });

      // Poll for OCR status if enabled
      if (enableOCR && result.document.id) {
        pollOCRStatus(uploadFile.id, result.document.id);
      } else {
        updateFile(uploadFile.id, { status: 'completed' });
      }
    } catch (error: any) {
      updateFile(uploadFile.id, {
        status: 'failed',
        error: error.message,
      });
    }
  };

  const pollOCRStatus = async (fileId: string, documentId: string) => {
    const maxAttempts = 30; // 5 minutes at 10 second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/ocr-status`);
        if (!response.ok) return;

        const { status, progress } = await response.json();

        updateFile(fileId, {
          ocrStatus: status,
          ocrProgress: progress || 0,
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
            error: 'OCR timeout',
          });
        }
      } catch (error) {
        console.error('OCR polling error:', error);
        updateFile(fileId, {
          status: 'completed',
          ocrStatus: 'failed',
          error: 'OCR monitoring failed',
        });
      }
    };

    // Start polling after initial delay
    setTimeout(poll, 5000);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);

    const uploadPromises = files
      .filter((f) => f.status === 'pending')
      .map((file) => uploadFile(file));

    try {
      await Promise.all(uploadPromises);

      // Wait a bit for all files to complete processing
      setTimeout(() => {
        const completedDocuments = files
          .filter((f) => f.documentId)
          .map((f) => ({ id: f.documentId, name: f.file.name }));

        onUploadComplete?.(completedDocuments);
        setIsUploading(false);
      }, 2000);
    } catch {
      setError('Some uploads failed. Please check individual file statuses.');
      setIsUploading(false);
    }
  };

  const retryUpload = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      updateFile(fileId, { status: 'pending', error: undefined });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && ['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
      return <FileImage className="h-5 w-5" />;
    }
    if (ext === 'pdf') {
      return <FileText className="h-5 w-5" />;
    }
    return <FileType className="h-5 w-5" />;
  };

  const getStatusIcon = (file: UploadFile) => {
    switch (file.status) {
      case 'pending':
        return <Upload className="h-4 w-4 text-muted-foreground" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'processing':
        return file.ocrStatus === 'processing' ? (
          <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        );
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (file: UploadFile) => {
    switch (file.status) {
      case 'pending':
        return 'Ready to upload';
      case 'uploading':
        return `Uploading... ${file.progress}%`;
      case 'processing':
        return file.ocrStatus === 'processing'
          ? `OCR Processing... ${file.ocrProgress || 0}%`
          : 'Processing...';
      case 'completed':
        return enableOCR && file.ocrStatus === 'completed'
          ? 'Upload & OCR Complete'
          : 'Upload Complete';
      case 'failed':
        return file.error || 'Upload failed';
      default:
        return '';
    }
  };

  const canUpload = files.length > 0 && !isUploading && files.some((f) => f.status === 'pending');
  const hasFailedUploads = files.some((f) => f.status === 'failed');
  const allCompleted = files.length > 0 && files.every((f) => f.status === 'completed');

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
            {files.length > 0 && <Badge variant="secondary">{files.length} files</Badge>}
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upload Configuration */}
        {showMetadataForm && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium">Upload Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="document-type">Default Document Type</Label>
                <Select value={defaultType} onValueChange={setDefaultType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="source">Source</Label>
                <Select value={defaultSource} onValueChange={setDefaultSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UPLOAD_SOURCES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        <div className="flex items-center gap-2">
                          <source.icon className="h-4 w-4" />
                          {source.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for these documents..."
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable-ocr"
                  checked={enableOCR}
                  onCheckedChange={(checked) => setEnableOCR(checked === true)}
                />
                <Label htmlFor="enable-ocr" className="text-sm">
                  Enable OCR processing
                </Label>
              </div>

              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          ref={dropZoneRef}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">
            {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
          </h3>
          <p className="text-muted-foreground mb-4">Or click to browse and select files</p>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="mb-2">
            Browse Files
          </Button>
          <p className="text-xs text-muted-foreground">
            Supports: {allowedTypes.join(', ')} • Max size: {formatFileSize(maxFileSize)} • Max
            files: {maxFiles}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={allowedTypes.join(',')}
            onChange={(e) => e.target.files && handleFileSelection(Array.from(e.target.files))}
            className="hidden"
          />
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        )}

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Files to Upload</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiles([])}
                  disabled={isUploading}
                >
                  Clear All
                </Button>
                {hasFailedUploads && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      files.filter((f) => f.status === 'failed').forEach((f) => retryUpload(f.id))
                    }
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Failed
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-1">{getFileIcon(file.file.name)}</div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate" title={file.file.name}>
                            {file.file.name}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span>{formatFileSize(file.file.size)}</span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {file.type.replace('-', ' ')}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            {getStatusIcon(file)}
                            <span className="text-sm">{getStatusText(file)}</span>
                          </div>

                          {file.status === 'uploading' && (
                            <Progress value={file.progress} className="mt-2" />
                          )}

                          {file.status === 'processing' && file.ocrStatus === 'processing' && (
                            <Progress value={file.ocrProgress || 0} className="mt-2" />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {file.status === 'failed' && (
                          <Button variant="outline" size="sm" onClick={() => retryUpload(file.id)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          disabled={file.status === 'uploading' || file.status === 'processing'}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Actions */}
        {files.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </div>

            <div className="flex gap-2">
              {allCompleted ? (
                <Button onClick={onClose}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Done
                </Button>
              ) : (
                <Button onClick={handleUpload} disabled={!canUpload} className="min-w-32">
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
