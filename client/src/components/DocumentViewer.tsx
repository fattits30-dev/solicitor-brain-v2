import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DocumentViewerProps {
  documentId?: string;
  documentUrl?: string;
  documentName?: string;
  onClose?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  documentUrl,
  documentName = 'Document',
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ocrText, setOcrText] = useState<string>('');
  const [extractedEntities, setExtractedEntities] = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (documentId) {
      loadDocument();
    } else if (documentUrl) {
      setLoading(false);
    }
  }, [documentId, documentUrl]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) throw new Error('Failed to load document');
      
      const data = await response.json();
      setOcrText(data.ocrText || '');
      setExtractedEntities(data.entities || []);
      setTotalPages(data.pageCount || 1);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  
  const handleDownload = async () => {
    if (documentUrl) {
      const link = document.createElement('a');
      link.href = documentUrl;
      link.download = documentName;
      link.click();
    }
  };

  const handleOCR = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents/${documentId}/ocr`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('OCR processing failed');
      
      const data = await response.json();
      setOcrText(data.text);
      setExtractedEntities(data.entities || []);
      setLoading(false);
    } catch (err: any) {
      setError(`OCR Error: ${err.message}`);
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const viewerStyles = {
    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
    transition: 'transform 0.3s ease'
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={`${isFullscreen ? 'fixed inset-0 z-50' : ''} flex flex-col h-full`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {documentName}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            
            {/* Rotation */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleRotate}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            
            {/* Fullscreen */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            
            {/* Download */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
            
            {/* Close */}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden">
        <Tabs defaultValue="viewer" className="h-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="viewer">Document</TabsTrigger>
            <TabsTrigger value="text">Extracted Text</TabsTrigger>
            <TabsTrigger value="entities">Entities</TabsTrigger>
          </TabsList>
          
          <TabsContent value="viewer" className="h-full mt-4">
            <div className="relative h-full overflow-auto bg-gray-100 rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading document...</p>
                  </div>
                </div>
              ) : documentUrl ? (
                <div className="flex flex-col h-full">
                  {/* PDF Viewer */}
                  <div className="flex-1 overflow-auto p-4">
                    <iframe
                      src={`${documentUrl}#zoom=${zoom}`}
                      className="w-full h-full min-h-[600px] bg-white rounded shadow-lg"
                      style={viewerStyles}
                      title={documentName}
                    />
                  </div>
                  
                  {/* Page Navigation */}
                  <div className="flex items-center justify-center gap-4 p-3 bg-white border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
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
            <div className="h-full overflow-auto">
              {ocrText ? (
                <div className="bg-white p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Extracted Text (OCR)</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOCR}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Re-process OCR
                    </Button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded">
                    {ocrText}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-muted-foreground mb-4">No text extracted yet</p>
                  <Button onClick={handleOCR}>
                    <Search className="h-4 w-4 mr-2" />
                    Extract Text with OCR
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="entities" className="h-full mt-4">
            <div className="h-full overflow-auto">
              {extractedEntities.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold">Extracted Entities</h3>
                  <div className="grid gap-3">
                    {extractedEntities.map((entity, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-sm font-medium text-primary">
                              {entity.type}
                            </span>
                            <p className="text-sm mt-1">{entity.value}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {entity.confidence ? `${(entity.confidence * 100).toFixed(1)}%` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No entities extracted</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};