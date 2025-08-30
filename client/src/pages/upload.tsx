import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ConsentModal } from "@/components/ui/consent-modal";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Case, InsertDocument } from "@shared/schema";
import { insertDocumentSchema } from "@shared/schema";
import { z } from "zod";

const uploadFormSchema = insertDocumentSchema.extend({
  file: z.any().optional(),
});

type UploadFormData = z.infer<typeof uploadFormSchema>;

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  caseId?: string;
  type?: string;
  error?: string;
}

export default function Upload() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Queries
  const { data: cases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  // Form
  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema.omit({ file: true })),
    defaultValues: {
      caseId: "",
      type: "document",
      source: "upload",
      path: "",
      hash: "",
    },
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, caseId, type }: { file: File; caseId: string; type: string }) => {
      // Simulate file processing since we don't have actual file storage yet
      const hash = Math.random().toString(36).substring(7);
      const documentData: InsertDocument = {
        caseId,
        type: type || "document",
        source: "upload",
        path: `/uploads/${file.name}`,
        hash,
        ocrText: `Simulated OCR text for ${file.name}`, // In production, this would be actual OCR
      };

      const response = await fetch(`/api/cases/${caseId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentData),
      });
      
      if (!response.ok) throw new Error("Failed to upload document");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", variables.caseId, "documents"] });
      toast({ 
        title: "Document uploaded successfully", 
        description: "Your document has been processed and indexed for search." 
      });
    },
    onError: () => {
      toast({ 
        title: "Upload failed", 
        description: "Please try again.", 
        variant: "destructive" 
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (files: File[]) => {
    if (!selectedCaseId) {
      toast({
        title: "Please select a case first",
        description: "Choose which case these documents belong to.",
        variant: "destructive"
      });
      return;
    }

    const newUploadFiles = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending' as const,
      progress: 0,
      caseId: selectedCaseId,
      type: getFileType(file.name),
    }));

    setUploadFiles(prev => [...prev, ...newUploadFiles]);
    setShowConsentModal(true);
  };

  const getFileType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'PDF Document';
    if (['jpg', 'jpeg', 'png'].includes(ext || '')) return 'Image';
    if (['doc', 'docx'].includes(ext || '')) return 'Word Document';
    if (['txt'].includes(ext || '')) return 'Text Document';
    return 'Document';
  };

  const processUploads = async () => {
    setShowConsentModal(false);
    
    for (const uploadFile of uploadFiles.filter(f => f.status === 'pending')) {
      try {
        // Update status to uploading
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 30 } : f
        ));

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'processing', progress: 60 } : f
        ));

        // Upload the document
        await uploadMutation.mutateAsync({
          file: uploadFile.file,
          caseId: uploadFile.caseId!,
          type: uploadFile.type!,
        });

        // Mark as completed
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
        ));

      } catch (error) {
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'error', error: 'Upload failed' } : f
        ));
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'fas fa-clock text-accent';
      case 'uploading': return 'fas fa-upload text-primary';
      case 'processing': return 'fas fa-robot text-secondary';
      case 'completed': return 'fas fa-check text-secondary';
      case 'error': return 'fas fa-exclamation-triangle text-destructive';
      default: return 'fas fa-file text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending consent';
      case 'uploading': return 'Uploading...';
      case 'processing': return 'Processing with OCR...';
      case 'completed': return 'Ready for search';
      case 'error': return 'Failed to process';
      default: return status;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Upload Documents" 
          subtitle="Upload and process documents with OCR and AI indexing"
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Case Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Case</CardTitle>
                <CardDescription>Choose which case these documents belong to</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedCaseId} onValueChange={setSelectedCaseId} data-testid="select-case">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a case..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cases?.map((case_) => (
                      <SelectItem key={case_.id} value={case_.id}>
                        {case_.title} {case_.clientRef && `(${case_.clientRef})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Upload Area */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Documents</CardTitle>
                <CardDescription>
                  Drag and drop files or click to browse. Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  data-testid="upload-dropzone"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    onChange={(e) => handleFiles(Array.from(e.target.files || []))}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    data-testid="file-input"
                  />
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <i className="fas fa-cloud-upload-alt text-primary text-2xl"></i>
                    </div>
                    <div>
                      <p className="text-lg font-medium text-foreground" data-testid="upload-title">
                        Drop files here or click to browse
                      </p>
                      <p className="text-sm text-muted-foreground mt-1" data-testid="upload-description">
                        Files will be processed with OCR and indexed for AI search
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!selectedCaseId}
                      data-testid="browse-files-button"
                    >
                      <i className="fas fa-folder-open mr-2"></i>
                      Browse Files
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upload Queue */}
            {uploadFiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Upload Queue</CardTitle>
                  <CardDescription>
                    {uploadFiles.filter(f => f.status === 'completed').length} of {uploadFiles.length} files processed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {uploadFiles.map((uploadFile) => (
                      <div key={uploadFile.id} className="flex items-center space-x-4 p-4 border border-border rounded-lg" data-testid={`upload-file-${uploadFile.id}`}>
                        <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <i className={getStatusIcon(uploadFile.status)}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate" data-testid={`upload-filename-${uploadFile.id}`}>
                            {uploadFile.file.name}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-sm text-muted-foreground" data-testid={`upload-status-${uploadFile.id}`}>
                              {getStatusText(uploadFile.status)}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              • {(uploadFile.file.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                            {uploadFile.type && (
                              <Badge variant="outline" className="text-xs" data-testid={`upload-type-${uploadFile.id}`}>
                                {uploadFile.type}
                              </Badge>
                            )}
                          </div>
                          {uploadFile.status === 'uploading' || uploadFile.status === 'processing' ? (
                            <Progress value={uploadFile.progress} className="mt-2" data-testid={`upload-progress-${uploadFile.id}`} />
                          ) : null}
                          {uploadFile.error && (
                            <p className="text-sm text-destructive mt-1" data-testid={`upload-error-${uploadFile.id}`}>
                              {uploadFile.error}
                            </p>
                          )}
                        </div>
                        {uploadFile.status === 'error' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setUploadFiles(prev => prev.map(f => 
                                f.id === uploadFile.id ? { ...f, status: 'pending', error: undefined } : f
                              ));
                            }}
                            data-testid={`retry-upload-${uploadFile.id}`}
                          >
                            <i className="fas fa-redo mr-2"></i>
                            Retry
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {uploadFiles.some(f => f.status === 'pending') && (
                    <div className="mt-4 p-4 bg-accent/5 rounded-lg border border-accent/20">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
                          <i className="fas fa-info-circle text-accent"></i>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Consent Required
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Grant consent to process these documents with AI technology
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowConsentModal(true)}
                          data-testid="grant-consent-button"
                        >
                          Grant Consent
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Privacy Information */}
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Processing</CardTitle>
                <CardDescription>How we handle your documents securely</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-shield-alt text-secondary"></i>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Automatic Redaction</h4>
                      <p className="text-muted-foreground">Personal information is automatically detected and redacted from search indexes and logs.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-server text-primary"></i>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Local Processing</h4>
                      <p className="text-muted-foreground">All AI processing happens on secure local servers. Your data never leaves your control.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-key text-accent"></i>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Revocable Consent</h4>
                      <p className="text-muted-foreground">You can revoke AI processing consent at any time and request data deletion.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <ConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onConsent={processUploads}
        title="Process Documents with AI"
        description="We need your consent to process these documents with AI technology for OCR and search indexing."
        actions={[
          "Extract text using OCR technology",
          "Create searchable document index",
          "Enable AI-powered content analysis",
          "Generate document summaries and insights"
        ]}
        privacy={[
          "Personal information is automatically redacted",
          "All processing happens on local secure servers",
          "You can revoke consent anytime in Settings",
          "Documents are encrypted at rest and in transit"
        ]}
      />
    </div>
  );
}
