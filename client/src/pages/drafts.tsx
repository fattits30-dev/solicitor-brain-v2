import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Case, Draft, InsertDraft } from "@shared/schema";
import { insertDraftSchema } from "@shared/schema";

const tonePresets = [
  {
    value: "professional",
    label: "Professional",
    description: "Formal business language suitable for most legal correspondence",
    icon: "fas fa-briefcase",
    color: "text-primary"
  },
  {
    value: "empathetic",
    label: "Empathetic",
    description: "Compassionate tone for sensitive matters and client support",
    icon: "fas fa-heart",
    color: "text-secondary"
  },
  {
    value: "firm",
    label: "Firm",
    description: "Direct and assertive language for negotiations and demands",
    icon: "fas fa-gavel",
    color: "text-accent"
  },
  {
    value: "diplomatic",
    label: "Diplomatic",
    description: "Balanced approach for mediation and settlement discussions",
    icon: "fas fa-handshake",
    color: "text-secondary"
  }
];

export default function Drafts() {
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [draftContent, setDraftContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();

  // Queries
  const { data: cases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const { data: drafts } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
    select: (data) => data || [], // Ensure we always have an array
  });

  // Form for creating drafts
  const form = useForm<InsertDraft>({
    resolver: zodResolver(insertDraftSchema),
    defaultValues: {
      title: "",
      bodyMd: "",
      tone: "professional",
      status: "draft",
      caseId: "",
    },
  });

  // Create draft mutation
  const createDraftMutation = useMutation({
    mutationFn: async (data: InsertDraft) => {
      const response = await fetch(`/api/cases/${data.caseId}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create draft");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      setShowCreateModal(false);
      form.reset();
      toast({ title: "Draft created successfully", description: "Your draft has been saved and is ready for editing." });
    },
    onError: () => {
      toast({ title: "Error creating draft", description: "Please try again.", variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertDraft) => {
    createDraftMutation.mutate(data);
  };

  const generateAIDraft = async () => {
    if (!selectedCaseId || !form.getValues("title")) {
      toast({
        title: "Please fill required fields",
        description: "Select a case and provide a draft title before generating.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Simulate AI generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const selectedCase = cases?.find(c => c.id === selectedCaseId);
      const toneInfo = tonePresets.find(t => t.value === selectedTone);
      
      const generatedContent = `# ${form.getValues("title")}

**Case Reference:** ${selectedCase?.clientRef || "N/A"}  
**Generated:** ${format(new Date(), "dd MMMM yyyy")}  
**Tone:** ${toneInfo?.label}

---

## Introduction

This document has been generated using AI assistance with a ${toneInfo?.label.toLowerCase()} tone for the case "${selectedCase?.title}".

## Key Points

- Point 1: [AI-generated content based on case context]
- Point 2: [Relevant legal considerations]
- Point 3: [Recommended actions or responses]

## Conclusion

This draft serves as a starting point and should be reviewed, customized, and verified by qualified legal professionals before use.

---

*Generated by Solicitor Brain AI Assistant*  
*Please review all content for accuracy and completeness*`;

      setDraftContent(generatedContent);
      form.setValue("bodyMd", generatedContent);
      
      toast({ 
        title: "Draft generated successfully", 
        description: `AI has created a ${toneInfo?.label.toLowerCase()} draft for your review.` 
      });
      
    } catch (error) {
      toast({ 
        title: "Generation failed", 
        description: "Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-accent text-accent-foreground";
      case "review": return "bg-secondary text-secondary-foreground";
      case "final": return "bg-primary text-primary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Draft Studio" 
          subtitle="AI-assisted document drafting with multiple tone presets"
        >
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button data-testid="create-draft-button">
                <i className="fas fa-plus mr-2"></i>
                New Draft
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" data-testid="create-draft-modal">
              <DialogHeader>
                <DialogTitle>Create AI-Assisted Draft</DialogTitle>
                <DialogDescription>
                  Generate a legal document draft using AI assistance with your chosen tone and style.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="caseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Case</FormLabel>
                        <Select onValueChange={(value) => { field.onChange(value); setSelectedCaseId(value); }} value={field.value} data-testid="select-case-draft">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a case..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cases?.map((case_) => (
                              <SelectItem key={case_.id} value={case_.id}>
                                {case_.title} {case_.clientRef && `(${case_.clientRef})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Draft Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Response to Settlement Offer, Notice of Appeal" {...field} data-testid="input-draft-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tone Preset</FormLabel>
                        <Select onValueChange={(value) => { field.onChange(value); setSelectedTone(value); }} value={field.value} data-testid="select-tone">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tonePresets.map((tone) => (
                              <SelectItem key={tone.value} value={tone.value}>
                                <div className="flex items-center space-x-2">
                                  <i className={`${tone.icon} ${tone.color}`}></i>
                                  <span>{tone.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* AI Generation Section */}
                  <div className="border border-border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-robot text-primary"></i>
                        <span className="font-medium text-foreground">AI Assistant</span>
                      </div>
                      <Button 
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateAIDraft}
                        disabled={isGenerating || !selectedCaseId || !form.getValues("title")}
                        data-testid="generate-ai-draft"
                      >
                        {isGenerating ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Generating...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-magic mr-2"></i>
                            Generate Draft
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      AI will create a draft based on your case details using the selected tone preset. You can then edit and refine the content.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="bodyMd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Draft content will appear here after AI generation, or you can write manually..."
                            value={draftContent || field.value}
                            onChange={(e) => {
                              setDraftContent(e.target.value);
                              field.onChange(e.target.value);
                            }}
                            className="min-h-64 font-mono text-sm"
                            data-testid="input-draft-content"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex flex-col-reverse sm:flex-row gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1" data-testid="cancel-create-draft">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createDraftMutation.isPending} className="flex-1" data-testid="submit-create-draft">
                      {createDraftMutation.isPending ? "Saving..." : "Save Draft"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </Header>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Tone Presets */}
            <Card>
              <CardHeader>
                <CardTitle>Tone Presets</CardTitle>
                <CardDescription>Choose the appropriate tone for your legal documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tonePresets.map((tone) => (
                    <div 
                      key={tone.value}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTone === tone.value 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedTone(tone.value)}
                      data-testid={`tone-preset-${tone.value}`}
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <i className={`${tone.icon} ${tone.color}`}></i>
                        </div>
                        <h3 className="font-medium text-foreground">{tone.label}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{tone.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Drafts */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Drafts</CardTitle>
                    <CardDescription>Your saved and AI-generated document drafts</CardDescription>
                  </div>
                  <Badge variant="outline" data-testid="drafts-count">
                    {drafts?.length || 0} drafts
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {!drafts || drafts.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8" data-testid="no-drafts">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-edit text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No drafts yet</h3>
                    <p className="text-sm mb-4">
                      Create your first AI-assisted legal document draft to get started.
                    </p>
                    <Button onClick={() => setShowCreateModal(true)} data-testid="create-first-draft">
                      <i className="fas fa-plus mr-2"></i>
                      Create Your First Draft
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {drafts.map((draft) => {
                      const relatedCase = cases?.find(c => c.id === draft.caseId);
                      const toneInfo = tonePresets.find(t => t.value === draft.tone);
                      
                      return (
                        <div key={draft.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer" data-testid={`draft-${draft.id}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                <i className={`${toneInfo?.icon || 'fas fa-edit'} text-primary`}></i>
                              </div>
                              <div>
                                <h3 className="font-medium text-foreground" data-testid={`draft-title-${draft.id}`}>
                                  {draft.title}
                                </h3>
                                <p className="text-sm text-muted-foreground" data-testid={`draft-case-${draft.id}`}>
                                  {relatedCase?.title || "Unknown case"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={toneInfo?.color} variant="outline" data-testid={`draft-tone-${draft.id}`}>
                                {toneInfo?.label || draft.tone}
                              </Badge>
                              <Badge className={getStatusColor(draft.status)} data-testid={`draft-status-${draft.id}`}>
                                {draft.status}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`draft-preview-${draft.id}`}>
                              {draft.bodyMd.slice(0, 150)}...
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span data-testid={`draft-updated-${draft.id}`}>
                              Updated {format(new Date(draft.updatedAt), "dd MMM yyyy HH:mm")}
                            </span>
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm" data-testid={`edit-draft-${draft.id}`}>
                                <i className="fas fa-edit mr-1"></i>
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" data-testid={`export-draft-${draft.id}`}>
                                <i className="fas fa-download mr-1"></i>
                                Export
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Drafting Guidelines */}
            <Card>
              <CardHeader>
                <CardTitle>AI Drafting Guidelines</CardTitle>
                <CardDescription>Best practices for AI-assisted legal document creation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-shield-alt text-secondary"></i>
                      <h4 className="font-medium text-foreground">Always Review</h4>
                    </div>
                    <p className="text-muted-foreground">
                      AI-generated content must be reviewed and verified by qualified legal professionals before use.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-user-check text-primary"></i>
                      <h4 className="font-medium text-foreground">Client Context</h4>
                    </div>
                    <p className="text-muted-foreground">
                      Customize generated drafts for your specific case circumstances and client needs.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-balance-scale text-accent"></i>
                      <h4 className="font-medium text-foreground">Legal Accuracy</h4>
                    </div>
                    <p className="text-muted-foreground">
                      Verify all legal references, citations, and procedural requirements independently.
                    </p>
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
