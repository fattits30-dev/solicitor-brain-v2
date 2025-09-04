import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileImage,
  FileText,
  FileType,
  Loader2,
  Maximize2,
  MessageSquare,
  Printer,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface DocumentAnnotation {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  author: string;
  createdAt: string;
  type: 'note' | 'highlight' | 'redaction';
}

interface DocumentViewerProps {
  documentId?: string;
  documentUrl?: string;
  documentName?: string;
  documentType?: string;
  caseId?: string;
  onClose?: () => void;
  onAnnotationChange?: (annotations: DocumentAnnotation[]) => void;
  readOnly?: boolean;
}

interface DocumentMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  ocrText?: string;
  pageCount?: number;
  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
    page: number;
    position?: { x: number; y: number; width: number; height: number };
  }>;
  annotations: DocumentAnnotation[];
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  documentUrl,
  documentName = 'Document',
  documentType = 'pdf',
  caseId: _caseId,
  onClose,
  onAnnotationChange: _onAnnotationChange,
  readOnly = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('viewer');
  const [newNote, setNewNote] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);

  const viewerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (documentId) {
      loadDocument();
    } else if (documentUrl) {
      setLoading(false);
      setMetadata({
        id: 'preview',
        name: documentName,
        type: documentType,
        size: 0,
        uploadedAt: new Date().toISOString(),
        ocrStatus: 'pending',
        annotations: [],
      });
    }
  }, [documentId, documentUrl, documentName, documentType]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.status}`);
      }

      const data = await response.json();
      setMetadata(data);

      // If OCR is in progress, poll for updates
      if (data.ocrStatus === 'processing') {
        pollOcrStatus();
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const pollOcrStatus = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/ocr-status`);
        if (response.ok) {
          const { status, progress, text, entities } = await response.json();

          setOcrProgress(progress || 0);

          if (status === 'completed' || status === 'failed') {
            clearInterval(pollInterval);
            setMetadata((prev) =>
              prev
                ? {
                    ...prev,
                    ocrStatus: status,
                    ocrText: text,
                    entities: entities || [],
                  }
                : null,
            );
          }
        }
      } catch (error) {
        console.error('Error polling OCR status:', error);
      }
    }, 2000);

    // Clear interval after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = async () => {
    if (documentId) {
      try {
        const response = await fetch(`/api/documents/${documentId}/download`);
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = metadata?.name || 'document';
        link.click();
        window.URL.revokeObjectURL(url);
      } catch {
        setError('Failed to download document');
      }
    } else if (documentUrl) {
      const link = document.createElement('a');
      link.href = documentUrl;
      link.download = documentName;
      link.click();
    }
  };

  const handleOCRProcess = async () => {
    if (!documentId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/documents/${documentId}/ocr`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('OCR processing failed');

      setMetadata((prev) => (prev ? { ...prev, ocrStatus: 'processing' } : null));
      setOcrProgress(0);
      pollOcrStatus();
      setLoading(false);
    } catch (err: any) {
      setError(`OCR Error: ${err.message}`);
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.print();
    }
  };

  const handleShare = async () => {
    if (navigator.share && documentId) {
      try {
        await navigator.share({
          title: documentName,
          text: `Legal document: ${documentName}`,
          url: `/documents/${documentId}`,
        });
      } catch {
        // Fallback to clipboard
        navigator.clipboard.writeText(`${window.location.origin}/documents/${documentId}`);
      }
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !documentId) return;

    const annotation: DocumentAnnotation = {
      id: `note-${Date.now()}`,
      page: currentPage,
      x: 50, // Default position
      y: 50,
      width: 200,
      height: 100,
      content: newNote.trim(),
      author: 'Current User', // Would get from auth context
      createdAt: new Date().toISOString(),
      type: 'note',
    };

    const updatedAnnotations = [...(metadata?.annotations || []), annotation];

    setMetadata((prev) => (prev ? { ...prev, annotations: updatedAnnotations } : null));
    setNewNote('');

    // Save to backend
    try {
      await fetch(`/api/documents/${documentId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(annotation),
      });

      _onAnnotationChange?.(updatedAnnotations);
    } catch (error) {
      console.error('Failed to save annotation:', error);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const getFileIcon = () => {
    const type = metadata?.type || documentType;
    if (type.includes('pdf')) return <FileText className="h-5 w-5" />;
    if (type.includes('image')) return <FileImage className="h-5 w-5" />;
    return <FileType className="h-5 w-5" />;
  };

  const getStatusBadge = () => {
    if (!metadata) return null;

    const statusConfig = {
      pending: { variant: 'secondary' as const, label: 'Pending OCR' },
      processing: { variant: 'default' as const, label: 'Processing...' },
      completed: { variant: 'outline' as const, label: 'OCR Complete' },
      failed: { variant: 'destructive' as const, label: 'OCR Failed' },
    };

    const config = statusConfig[metadata.ocrStatus];
    return (
      <Badge variant={config.variant} className="ml-2">
        {config.label}
        {metadata.ocrStatus === 'processing' && <Loader2 className="h-3 w-3 ml-1 animate-spin" />}
      </Badge>
    );
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" onClick={loadDocument} className="ml-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={`${isFullscreen ? 'fixed inset-0 z-50' : ''} flex flex-col h-full`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getFileIcon()}
            <span className="truncate max-w-md" title={documentName}>
              {documentName}
            </span>
            {getStatusBadge()}
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* View Controls */}
            <div className="flex items-center gap-1 border-r pr-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 25}
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 300}
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleRotate} title="Rotate">
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Action Controls */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={handlePrint} title="Print">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleShare} title="Share">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleDownload} title="Download">
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              {onClose && (
                <Button variant="ghost" size="icon" onClick={onClose} title="Close">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* OCR Progress */}
        {metadata?.ocrStatus === 'processing' && (
          <div className="mt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing document with OCR... {ocrProgress}%
            </div>
            <Progress value={ocrProgress} className="h-2" />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="viewer">
              <Eye className="h-4 w-4 mr-2" />
              Document
            </TabsTrigger>
            <TabsTrigger value="text" disabled={!metadata?.ocrText}>
              <FileText className="h-4 w-4 mr-2" />
              Text
            </TabsTrigger>
            <TabsTrigger value="entities" disabled={!metadata?.entities?.length}>
              <Search className="h-4 w-4 mr-2" />
              Entities
            </TabsTrigger>
            <TabsTrigger value="notes" disabled={readOnly}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Notes ({metadata?.annotations.filter((a) => a.type === 'note').length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="viewer" className="h-full mt-4">
            <div ref={viewerRef} className="relative h-full overflow-hidden bg-gray-100 rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading document...</p>
                  </div>
                </div>
              ) : documentUrl || (documentId && metadata) ? (
                <div className="flex flex-col h-full">
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      {documentType?.includes('pdf') ? (
                        <iframe
                          ref={iframeRef}
                          src={documentUrl || `/api/documents/${documentId}/view`}
                          className="w-full h-full min-h-[600px] bg-white rounded shadow-lg border-0 viewer-transform"
                          style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
                          title={documentName}
                          loading="lazy"
                        />
                      ) : documentType?.includes('image') ? (
                        <div className="flex justify-center">
                          <img
                            src={documentUrl || `/api/documents/${documentId}/view`}
                            alt={documentName}
                            className="max-w-full h-auto rounded shadow-lg viewer-transform"
                            style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
                          />
                        </div>
                      ) : (
                        <div className="bg-white p-6 rounded shadow-lg">
                          <pre className="whitespace-pre-wrap text-sm font-mono">
                            {metadata?.ocrText ||
                              'Text content will appear here after OCR processing.'}
                          </pre>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Page Navigation */}
                  {metadata?.pageCount && metadata.pageCount > 1 && (
                    <div className="flex items-center justify-center gap-4 p-3 bg-white border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm min-w-0">
                        Page {currentPage} of {metadata.pageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((prev) => Math.min(metadata.pageCount || 1, prev + 1))
                        }
                        disabled={currentPage >= (metadata.pageCount || 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No document selected</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="text" className="h-full mt-4">
            <ScrollArea className="h-full">
              {metadata?.ocrText ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Extracted Text (OCR)</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOCRProcess}
                        disabled={!documentId}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Re-process OCR
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(metadata.ocrText || '')}
                      >
                        Copy Text
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                      {metadata.ocrText}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No text extracted yet</p>
                  <Button onClick={handleOCRProcess} disabled={!documentId}>
                    <Search className="h-4 w-4 mr-2" />
                    Extract Text with OCR
                  </Button>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="entities" className="h-full mt-4">
            <ScrollArea className="h-full">
              {metadata?.entities && metadata.entities.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold">Extracted Legal Entities</h3>
                  <div className="grid gap-3">
                    {metadata.entities.map((entity, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-lg border hover:border-primary/50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline" className="text-xs">
                            {entity.type}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {entity.confidence ? `${(entity.confidence * 100).toFixed(1)}%` : ''}
                            {entity.page && ` • Page ${entity.page}`}
                          </div>
                        </div>
                        <p className="text-sm font-medium">{entity.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Search className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">No entities extracted</p>
                    <p className="text-xs text-muted-foreground">
                      Entities will appear here after OCR processing
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notes" className="h-full mt-4">
            <div className="h-full flex flex-col">
              {!readOnly && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Add Note</h4>
                  <div className="flex gap-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note about this document..."
                      className="min-h-[60px]"
                    />
                    <Button onClick={addNote} disabled={!newNote.trim()}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="flex-1">
                {metadata?.annotations && metadata.annotations.length > 0 ? (
                  <div className="space-y-3">
                    {metadata.annotations
                      .filter((annotation) => annotation.type === 'note')
                      .map((annotation) => (
                        <div key={annotation.id} className="bg-white p-4 rounded-lg border">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-primary">
                              {annotation.author}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(annotation.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{annotation.content}</p>
                          {annotation.page && (
                            <div className="mt-2">
                              <Badge variant="outline" className="text-xs">
                                Page {annotation.page}
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No notes yet</p>
                      {!readOnly && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Add notes above to get started
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
