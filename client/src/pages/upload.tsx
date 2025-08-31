import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentUpload, DocumentManager } from "@/components/documents";
import { useToast } from "@/hooks/use-toast";
import type { Case } from "@shared/schema";
import { Upload, FileText, Shield, Server, Key } from "lucide-react";

export default function UploadPage() {
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [view, setView] = useState<'upload' | 'manager'>('upload');
  const { toast } = useToast();

  // Queries
  const { data: cases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const handleUploadComplete = (documents: any[]) => {
    toast({
      title: "Documents uploaded successfully",
      description: `${documents.length} document(s) have been processed and are ready for use.`,
    });
    
    // Switch to document manager view
    setView('manager');
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Document Management" 
          subtitle="Upload, view, and manage legal documents with AI-powered processing"
        />
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full flex flex-col space-y-6">
            {/* Case Selection and View Toggle */}
            <div className="flex items-center justify-between">
              <Card className="flex-1 mr-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Select Case</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a case for document management..." />
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
              
              <div className="flex items-center space-x-2">
                <Button
                  variant={view === 'upload' ? 'default' : 'outline'}
                  onClick={() => setView('upload')}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
                <Button
                  variant={view === 'manager' ? 'default' : 'outline'}
                  onClick={() => setView('manager')}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Manage
                </Button>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
              <Tabs value={view} onValueChange={(v) => setView(v as 'upload' | 'manager')} className="h-full">
                <TabsContent value="upload" className="h-full mt-0">
                  {selectedCaseId ? (
                    <DocumentUpload
                      caseId={selectedCaseId}
                      onUploadComplete={handleUploadComplete}
                      autoOCR={true}
                      showMetadataForm={true}
                      maxFiles={10}
                      maxFileSize={10 * 1024 * 1024} // 10MB
                      allowedTypes={['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.gif']}
                    />
                  ) : (
                    <Card className="h-full flex items-center justify-center">
                      <CardContent className="text-center">
                        <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Select a Case First</h3>
                        <p className="text-muted-foreground">
                          Choose which case these documents belong to before uploading.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="manager" className="h-full mt-0">
                  <DocumentManager
                    caseId={selectedCaseId}
                    allowUpload={true}
                    allowDelete={true}
                    showCaseInfo={!selectedCaseId}
                    defaultView="list"
                    height="100%"
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Privacy Information Footer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy & Security Information
                </CardTitle>
                <CardDescription>How we protect your legal documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Automatic PII Redaction</h4>
                      <p className="text-muted-foreground">
                        Personal information is automatically detected and redacted from search indexes, 
                        logs, and AI processing to maintain client confidentiality.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Server className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Local AI Processing</h4>
                      <p className="text-muted-foreground">
                        All OCR, document analysis, and AI features run on secure local servers. 
                        Your sensitive legal documents never leave your infrastructure.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Key className="h-4 w-4 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Granular Consent Control</h4>
                      <p className="text-muted-foreground">
                        You control exactly which AI features process your documents. 
                        Consent can be revoked at any time with full data deletion.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}