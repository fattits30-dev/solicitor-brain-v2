import React, { useState } from 'react';
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { SearchInterface } from "@/components/SearchInterface";
import { DocumentViewer } from "@/components/DocumentViewer";
import { AIChatPanel } from "@/components/AIChatPanel";
import { DraftGenerator } from "@/components/DraftGenerator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  FileText, 
  MessageSquare, 
  FileSignature,
  Brain
} from 'lucide-react';

export default function AIWorkspace() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>();
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>();
  const [draftContent, setDraftContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState('search');

  const handleSelectDocument = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setActiveTab('viewer');
  };

  const handleGenerateDraft = (content: string) => {
    setDraftContent(content);
    setActiveTab('draft');
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="AI Workspace" 
          subtitle="Search, analyze documents, chat with AI, and generate drafts"
        />
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full max-w-7xl mx-auto">
            <div className="bg-card rounded-lg border border-border p-4 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Brain className="h-4 w-4" />
                <span>AI-powered legal workspace with document analysis and draft generation</span>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100%-5rem)]">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="search">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="viewer">
                  <FileText className="h-4 w-4 mr-2" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  AI Chat
                </TabsTrigger>
                <TabsTrigger value="draft">
                  <FileSignature className="h-4 w-4 mr-2" />
                  Draft
                </TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="h-[calc(100%-3rem)] mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <SearchInterface 
                    caseId={selectedCaseId}
                    onSelectDocument={handleSelectDocument}
                  />
                  <DocumentViewer 
                    documentId={selectedDocumentId}
                  />
                </div>
              </TabsContent>

              <TabsContent value="viewer" className="h-[calc(100%-3rem)] mt-4">
                <DocumentViewer 
                  documentId={selectedDocumentId}
                />
              </TabsContent>

              <TabsContent value="chat" className="h-[calc(100%-3rem)] mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <AIChatPanel 
                    caseId={selectedCaseId}
                    documentId={selectedDocumentId}
                    onGenerateDraft={handleGenerateDraft}
                  />
                  <DraftGenerator 
                    caseId={selectedCaseId}
                    initialContent={draftContent}
                  />
                </div>
              </TabsContent>

              <TabsContent value="draft" className="h-[calc(100%-3rem)] mt-4">
                <DraftGenerator 
                  caseId={selectedCaseId}
                  initialContent={draftContent}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}