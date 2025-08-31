import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Send, 
  Bot, 
  User,
  Sparkles,
  Brain,
  FileText,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Settings,
  Download,
  Upload,
  Paperclip,
  History,
  BookOpen,
  Scale,
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  MessageSquare,
  GitBranch,
  Zap,
  Star,
  Archive,
  Share,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  confidence?: number;
  processingTime?: number;
  context?: {
    documentId?: string;
    caseId?: string;
    attachedFiles?: Array<{
      id: string;
      name: string;
      type: string;
    }>;
    citations?: Array<{
      source: string;
      page?: number;
      confidence: number;
      excerpt?: string;
    }>;
  };
  feedback?: 'positive' | 'negative';
  starred?: boolean;
  exported?: boolean;
  branchPoint?: boolean;
}

interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  lastUpdated: Date;
  context?: {
    caseId?: string;
    documentIds?: string[];
  };
  metadata?: {
    totalTokens?: number;
    averageConfidence?: number;
    tags?: string[];
  };
}

interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: React.ComponentType<any>;
  category: 'legal' | 'drafting' | 'analysis' | 'compliance';
  description: string;
}

interface AIChatPanelProps {
  caseId?: string;
  documentId?: string;
  onGenerateDraft?: (content: string) => void;
  onDocumentAnalyze?: (documentId: string, analysis: string) => void;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  caseId,
  documentId,
  onGenerateDraft,
  onDocumentAnalyze,
  className,
  isExpanded = false,
  onToggleExpand
}) => {
  // Core state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [typingIndicator, setTypingIndicator] = useState(false);
  
  // Configuration state
  const [selectedModel, setSelectedModel] = useState<'llama3' | 'mistral' | 'gpt4'>('llama3');
  const [contextEnabled, setContextEnabled] = useState(true);
  const [chatMode, setChatMode] = useState<'general' | 'legal' | 'draft'>('general');
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  
  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick actions configuration
  const quickActions: QuickAction[] = [
    {
      id: 'summarize-case',
      label: 'Summarize Case',
      prompt: 'Please provide a comprehensive summary of this case, including key facts, legal issues, and current status.',
      icon: FileText,
      category: 'analysis',
      description: 'Get an overview of the case details'
    },
    {
      id: 'identify-issues',
      label: 'Identify Legal Issues',
      prompt: 'What are the primary legal issues in this case? Please analyze potential claims, defenses, and procedural considerations.',
      icon: Scale,
      category: 'legal',
      description: 'Analyze legal issues and claims'
    },
    {
      id: 'draft-letter',
      label: 'Draft Response Letter',
      prompt: 'Help me draft a professional response letter for this case. Please use an empathetic tone appropriate for the client\'s situation.',
      icon: Sparkles,
      category: 'drafting',
      description: 'Create legal correspondence'
    },
    {
      id: 'compliance-check',
      label: 'Compliance Review',
      prompt: 'Please review this matter for compliance with UK legal requirements, including limitation periods, procedural rules, and regulatory obligations.',
      icon: Shield,
      category: 'compliance',
      description: 'Check legal compliance requirements'
    },
    {
      id: 'timeline-analysis',
      label: 'Timeline Analysis',
      prompt: 'Create a chronological timeline of events and identify critical dates, including any limitation periods or deadlines.',
      icon: Clock,
      category: 'analysis',
      description: 'Analyze case timeline and deadlines'
    },
    {
      id: 'risk-assessment',
      label: 'Risk Assessment',
      prompt: 'Provide a risk assessment for this case, including likelihood of success, potential costs, and recommended strategy.',
      icon: AlertCircle,
      category: 'analysis',
      description: 'Assess case risks and strategy'
    }
  ];

  // Toast notifications
  const { toast } = useToast();

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingResponse]);

  useEffect(() => {
    // Load conversation history from localStorage
    const saved = localStorage.getItem('ai-chat-conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          lastUpdated: new Date(c.lastUpdated)
        })));
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Save conversations to localStorage
    if (conversations.length > 0) {
      localStorage.setItem('ai-chat-conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const createNewConversation = useCallback(() => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      name: `Chat ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: new Date(),
      lastUpdated: new Date(),
      context: { caseId, documentIds: documentId ? [documentId] : [] }
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setMessages([]);
    
    return newConversation;
  }, [caseId, documentId]);

  const switchConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setActiveConversationId(conversationId);
      setMessages(conversation.messages);
    }
  }, [conversations]);

  const updateCurrentConversation = useCallback((updates: Partial<Conversation>) => {
    if (!activeConversationId) return;
    
    setConversations(prev => prev.map(c => 
      c.id === activeConversationId 
        ? { ...c, ...updates, lastUpdated: new Date() }
        : c
    ));
  }, [activeConversationId]);

  const deleteConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
      setMessages([]);
    }
  }, [activeConversationId]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    // Ensure we have an active conversation
    let currentConversationId = activeConversationId;
    if (!currentConversationId) {
      const newConv = createNewConversation();
      currentConversationId = newConv.id;
    }

    const startTime = Date.now();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
      context: contextEnabled ? { 
        caseId, 
        documentId,
        attachedFiles 
      } : undefined
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setTypingIndicator(true);
    setStreamingResponse('');

    try {
      const requestBody = {
        message: textToSend,
        model: selectedModel,
        mode: chatMode,
        stream: streamingEnabled,
        context: contextEnabled ? {
          caseId,
          documentId,
          attachedFiles: attachedFiles.map(f => ({ id: f.id, name: f.name, type: f.type })),
          previousMessages: messages.slice(-5)
        } : undefined
      };

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      setTypingIndicator(false);
      let fullResponse = '';
      let confidence = 0.8; // Default confidence

      if (streamingEnabled && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          
          // Try to parse JSON chunks for metadata
          try {
            const parsed = JSON.parse(chunk);
            if (parsed.content) {
              fullResponse += parsed.content;
              setStreamingResponse(fullResponse);
            }
            if (parsed.confidence !== undefined) {
              confidence = parsed.confidence;
            }
          } catch {
            // If not JSON, treat as plain text
            fullResponse += chunk;
            setStreamingResponse(fullResponse);
          }
        }
      } else {
        const data = await response.json();
        fullResponse = data.response || data.content || '';
        confidence = data.confidence || 0.8;
      }

      const processingTime = Date.now() - startTime;
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date(),
        model: selectedModel,
        confidence,
        processingTime,
        context: contextEnabled ? { 
          caseId, 
          documentId,
          attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined
        } : undefined
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      setStreamingResponse('');
      
      // Update conversation
      updateCurrentConversation({ 
        messages: updatedMessages,
        metadata: {
          totalTokens: (updatedMessages.length * 100), // Rough estimate
          averageConfidence: updatedMessages
            .filter(m => m.confidence)
            .reduce((acc, m) => acc + (m.confidence || 0), 0) / 
            updatedMessages.filter(m => m.confidence).length || 0
        }
      });
      
      // Show confidence warning if low
      if (confidence < confidenceThreshold) {
        toast({
          title: 'Low Confidence Response',
          description: `The AI response has ${(confidence * 100).toFixed(0)}% confidence. Please verify the information.`,
          variant: 'destructive'
        });
      }
      
    } catch (error: any) {
      console.error('Chat error:', error);
      setTypingIndicator(false);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `I'm sorry, but I encountered an error: ${error.message}. Please try again or contact support if the problem persists.`,
        timestamp: new Date()
      };
      
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      updateCurrentConversation({ messages: updatedMessages });
      
      toast({
        title: 'Chat Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setTypingIndicator(false);
    }
  };

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleCopyMessage = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: 'Copied to clipboard',
        description: 'Message content copied successfully'
      });
    } catch (error) {
      console.error('Copy failed:', error);
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard',
        variant: 'destructive'
      });
    }
  }, []);

  const handleFeedback = useCallback((messageId: string, feedback: 'positive' | 'negative') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback } : msg
    ));
    
    // Update conversation
    const updatedMessages = messages.map(msg => 
      msg.id === messageId ? { ...msg, feedback } : msg
    );
    updateCurrentConversation({ messages: updatedMessages });
    
    toast({
      title: 'Feedback recorded',
      description: `Thank you for your ${feedback} feedback`
    });
  }, [messages, updateCurrentConversation]);

  const handleStarMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, starred: !msg.starred } : msg
    ));
    
    const updatedMessages = messages.map(msg => 
      msg.id === messageId ? { ...msg, starred: !msg.starred } : msg
    );
    updateCurrentConversation({ messages: updatedMessages });
  }, [messages, updateCurrentConversation]);

  const handleReset = useCallback(() => {
    if (activeConversationId) {
      deleteConversation(activeConversationId);
    }
    setMessages([]);
    setStreamingResponse('');
    setAttachedFiles([]);
  }, [activeConversationId, deleteConversation]);

  const handleGenerateDraft = useCallback((content: string) => {
    onGenerateDraft?.(content);
    toast({
      title: 'Draft created',
      description: 'Content has been sent to the draft editor'
    });
  }, [onGenerateDraft]);

  const handleFileAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newAttachments = files.map(file => ({
      id: Date.now().toString() + Math.random(),
      name: file.name,
      type: file.type,
      size: file.size,
      file
    }));
    
    setAttachedFiles(prev => [...prev, ...newAttachments]);
    toast({
      title: 'Files attached',
      description: `${files.length} file(s) attached to conversation`
    });
  }, []);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== attachmentId));
  }, []);

  const handleExportConversation = useCallback(async () => {
    if (!activeConversationId) return;
    
    const conversation = conversations.find(c => c.id === activeConversationId);
    if (!conversation) return;
    
    const exportData = {
      conversation,
      exportedAt: new Date().toISOString(),
      metadata: {
        caseId,
        documentId,
        totalMessages: conversation.messages.length,
        averageConfidence: conversation.metadata?.averageConfidence
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-chat-${conversation.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Conversation exported',
      description: 'Chat history downloaded as JSON file'
    });
  }, [activeConversationId, conversations, caseId, documentId]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    let contextualPrompt = action.prompt;
    
    if (caseId) {
      contextualPrompt += ` (Case ID: ${caseId})`;
    }
    
    if (attachedFiles.length > 0) {
      contextualPrompt += ` Please consider the attached documents: ${attachedFiles.map(f => f.name).join(', ')}.`;
    }
    
    setInput(contextualPrompt);
    
    // Optionally send immediately
    setTimeout(() => handleSend(contextualPrompt), 100);
  }, [caseId, attachedFiles, handleSend]);

  const getModeColor = useCallback((mode: string) => {
    switch (mode) {
      case 'legal':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'draft':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  }, []);

  const getModeIcon = useCallback((mode: string) => {
    switch (mode) {
      case 'legal':
        return <FileText className="h-3 w-3" />;
      case 'draft':
        return <Sparkles className="h-3 w-3" />;
      default:
        return <Brain className="h-3 w-3" />;
    }
  }, []);

  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  }, []);

  const getConfidenceLabel = useCallback((confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  }, []);

  const currentConversation = conversations.find(c => c.id === activeConversationId);

  return (
    <TooltipProvider>
      <Card className={cn("h-full flex flex-col", className)}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.json"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Legal Assistant
              {currentConversation && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {currentConversation.messages.length} messages
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-1">
              {/* Mode indicator */}
              <Badge className={getModeColor(chatMode)}>
                {getModeIcon(chatMode)}
                <span className="ml-1 capitalize">{chatMode}</span>
              </Badge>
              
              {/* Attachment indicator */}
              {attachedFiles.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Paperclip className="h-3 w-3 mr-1" />
                  {attachedFiles.length}
                </Badge>
              )}
              
              {/* History button */}
              <Sheet open={showHistory} onOpenChange={setShowHistory}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" title="Conversation history">
                    <History className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Conversation History</SheetTitle>
                    <SheetDescription>
                      Manage your AI chat conversations
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="mt-4 space-y-2">
                    <Button 
                      onClick={createNewConversation}
                      className="w-full"
                      size="sm"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      New Conversation
                    </Button>
                    
                    <ScrollArea className="h-[calc(100vh-200px)]">
                      <div className="space-y-2">
                        {conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={cn(
                              "p-3 rounded-lg border cursor-pointer transition-colors",
                              activeConversationId === conv.id
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted"
                            )}
                            onClick={() => {
                              switchConversation(conv.id);
                              setShowHistory(false);
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {conv.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {conv.messages.length} messages • {conv.lastUpdated.toLocaleDateString()}
                                </p>
                                {conv.metadata?.averageConfidence && (
                                  <div className="flex items-center mt-1">
                                    <div className="text-xs text-muted-foreground mr-2">
                                      Avg. confidence:
                                    </div>
                                    <Badge 
                                      variant="secondary" 
                                      className={cn("text-xs", getConfidenceColor(conv.metadata.averageConfidence))}
                                    >
                                      {(conv.metadata.averageConfidence * 100).toFixed(0)}%
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteConversation(conv.id);
                                }}
                              >
                                <Archive className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </SheetContent>
              </Sheet>
              
              {/* Settings button */}
              <Sheet open={showSettings} onOpenChange={setShowSettings}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" title="Chat settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>AI Chat Settings</SheetTitle>
                    <SheetDescription>
                      Configure your AI assistant preferences
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="mt-6 space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">AI Model</label>
                      <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value as 'llama3' | 'mistral' | 'gpt4')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="llama3">Llama 3.2 (Recommended)</SelectItem>
                          <SelectItem value="mistral">Mistral 7B</SelectItem>
                          <SelectItem value="gpt4">GPT-4 (Premium)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="streaming"
                          checked={streamingEnabled}
                          onCheckedChange={(checked) => setStreamingEnabled(!!checked)}
                        />
                        <label htmlFor="streaming" className="text-sm font-medium">
                          Enable streaming responses
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="context"
                          checked={contextEnabled}
                          onCheckedChange={(checked) => setContextEnabled(!!checked)}
                        />
                        <label htmlFor="context" className="text-sm font-medium">
                          Include case and document context
                        </label>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Confidence Threshold ({(confidenceThreshold * 100).toFixed(0)}%)
                      </label>
                      <input
                        type="range"
                        min="0.3"
                        max="0.9"
                        step="0.1"
                        value={confidenceThreshold}
                        onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Warn when AI confidence falls below this threshold
                      </p>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              
              {/* Export button */}
              {activeConversationId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleExportConversation}
                      title="Export conversation"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export conversation as JSON
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Expand toggle */}
              {onToggleExpand && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleExpand}
                  title={isExpanded ? "Minimize" : "Expand"}
                >
                  {isExpanded ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              )}
              
              {/* Reset button */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Clear conversation"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Clear Conversation</DialogTitle>
                    <DialogDescription>
                      This will permanently delete the current conversation. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button variant="destructive" onClick={handleReset}>
                      Clear Conversation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Mode Selector */}
          <Tabs value={chatMode} onValueChange={(v) => setChatMode(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general" className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                <span className="hidden sm:inline">General</span>
              </TabsTrigger>
              <TabsTrigger value="legal" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span className="hidden sm:inline">Legal Analysis</span>
              </TabsTrigger>
              <TabsTrigger value="draft" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">Document Drafting</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Attached Files Display */}
          {attachedFiles.length > 0 && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attached Files ({attachedFiles.length})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttachedFiles([])}
                  className="h-6 px-2 text-xs"
                >
                  Clear All
                </Button>
              </div>
              <div className="space-y-1">
                {attachedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between bg-background rounded p-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {(file.size / 1024).toFixed(1)}KB
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAttachment(file.id)}
                      className="h-6 w-6 ml-2"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages Container */}
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.length === 0 && !streamingResponse ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Bot className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {chatMode === 'legal' 
                      ? 'Legal Analysis Assistant'
                      : chatMode === 'draft'
                      ? 'Document Drafting Assistant'
                      : 'AI Legal Assistant'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md">
                    {chatMode === 'legal' 
                      ? 'I can help analyze legal documents, identify issues, assess risks, and provide guidance on UK law matters.'
                      : chatMode === 'draft'
                      ? 'I can help draft legal documents, letters, contracts, and other legal correspondence with appropriate tone and language.'
                      : 'I\'m here to assist with your legal work. Ask me anything about UK law, case analysis, or document drafting.'}
                  </p>
                  
                  {/* Quick Actions Grid */}
                  <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                    {quickActions
                      .filter(action => chatMode === 'general' || action.category === chatMode || 
                               (chatMode === 'legal' && ['legal', 'analysis', 'compliance'].includes(action.category)) ||
                               (chatMode === 'draft' && action.category === 'drafting'))
                      .slice(0, 6)
                      .map((action) => {
                        const Icon = action.icon;
                        return (
                          <Tooltip key={action.id}>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                className="h-auto p-4 flex flex-col items-center gap-2 hover:bg-primary/5"
                                onClick={() => handleQuickAction(action)}
                              >
                                <Icon className="h-6 w-6 text-primary" />
                                <span className="text-xs font-medium text-center">{action.label}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-sm">{action.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                  </div>
                  
                  <div className="mt-6 text-xs text-muted-foreground text-center">
                    <p>💡 Tip: You can attach documents using the paperclip icon below</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {message.role !== 'user' && (
                        <div className="flex-shrink-0 mt-1">
                          {message.role === 'assistant' ? (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                              <Bot className="h-4 w-4 text-primary" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'ml-auto' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'AI Assistant' : 'System'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                          {message.model && (
                            <Badge variant="outline" className="text-xs h-4 px-1">
                              {message.model}
                            </Badge>
                          )}
                          {message.confidence && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge 
                                  variant="secondary" 
                                  className={cn("text-xs h-4 px-1", getConfidenceColor(message.confidence))}
                                >
                                  {getConfidenceLabel(message.confidence)}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Confidence: {(message.confidence * 100).toFixed(1)}%</p>
                                {message.processingTime && (
                                  <p>Response time: {(message.processingTime / 1000).toFixed(1)}s</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {message.starred && (
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                          )}
                        </div>
                        
                        <div
                          className={`rounded-lg p-4 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : message.role === 'system'
                              ? 'bg-orange-50 border border-orange-200 text-orange-900'
                              : 'bg-muted border'
                          }`}
                        >
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                          </div>
                          
                          {/* Citations */}
                          {message.context?.citations && message.context.citations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-current/20">
                              <p className="text-xs font-medium mb-2 flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                Sources:
                              </p>
                              <div className="space-y-2">
                                {message.context.citations.map((citation, idx) => (
                                  <div key={idx} className="bg-background/80 rounded p-2 text-xs">
                                    <div className="flex items-center justify-between mb-1">
                                      <Badge 
                                        variant="secondary" 
                                        className="text-xs"
                                      >
                                        {citation.source}
                                        {citation.page && ` p.${citation.page}`}
                                      </Badge>
                                      <div className={cn(
                                        "text-xs font-medium",
                                        getConfidenceColor(citation.confidence)
                                      )}>
                                        {(citation.confidence * 100).toFixed(0)}%
                                      </div>
                                    </div>
                                    {citation.excerpt && (
                                      <p className="text-xs text-muted-foreground italic">
                                        "{citation.excerpt}"
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Attached files context */}
                          {message.context?.attachedFiles && message.context.attachedFiles.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-current/20">
                              <p className="text-xs font-medium mb-2 flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                Referenced Files:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {message.context.attachedFiles.map((file, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {file.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Message Actions */}
                        {(message.role === 'assistant' || message.role === 'user') && (
                          <div className="flex items-center gap-1 mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCopyMessage(message.content)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                            
                            {message.role === 'assistant' && (
                              <>
                                {(chatMode === 'draft' || message.content.includes('draft') || message.content.includes('letter')) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleGenerateDraft(message.content)}
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    Use as Draft
                                  </Button>
                                )}
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleStarMessage(message.id)}
                                >
                                  <Star className={`h-3 w-3 mr-1 ${message.starred ? 'text-yellow-500 fill-current' : ''}`} />
                                  {message.starred ? 'Starred' : 'Star'}
                                </Button>
                                
                                <div className="flex items-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-6 w-6 p-0 ${message.feedback === 'positive' ? 'text-green-600' : ''}`}
                                    onClick={() => handleFeedback(message.id, 'positive')}
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-6 w-6 p-0 ${message.feedback === 'negative' ? 'text-red-600' : ''}`}
                                    onClick={() => handleFeedback(message.id, 'negative')}
                                  >
                                    <ThumbsDown className="h-3 w-3" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {message.role === 'user' && (
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center ring-2 ring-secondary/30">
                            <User className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Typing Indicator */}
                  {typingIndicator && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary animate-pulse" />
                        </div>
                      </div>
                      <div className="flex-1 max-w-[85%]">
                        <div className="rounded-lg p-4 bg-muted border">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            <span className="ml-2 text-xs text-muted-foreground">AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Streaming Response */}
                  {streamingResponse && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary animate-pulse" />
                        </div>
                      </div>
                      <div className="flex-1 max-w-[85%]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">AI Assistant</span>
                          <Badge variant="outline" className="text-xs h-4 px-1 animate-pulse">
                            Streaming...
                          </Badge>
                        </div>
                        <div className="rounded-lg p-4 bg-muted border">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <div className="text-sm whitespace-pre-wrap">{streamingResponse}</div>
                          </div>
                          <div className="mt-2">
                            <div className="w-2 h-0.5 bg-primary animate-pulse rounded"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="space-y-3 border-t pt-4">
            {/* Quick Settings Bar */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Model:</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedModel === 'llama3' ? 'Llama 3.2' : selectedModel === 'mistral' ? 'Mistral' : 'GPT-4'}
                  </Badge>
                </div>
                
                {contextEnabled && (caseId || documentId) && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-muted-foreground">Context enabled</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFileAttach}
                  disabled={loading}
                  className="h-7 px-2"
                >
                  <Paperclip className="h-3 w-3 mr-1" />
                  Attach
                </Button>
              </div>
            </div>
            
            {/* Main Input */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={
                    chatMode === 'legal' 
                      ? 'Ask about legal issues, case analysis, or UK law...'
                      : chatMode === 'draft'
                      ? 'Describe the document you want to draft...'
                      : 'How can I help with your legal work today?'
                  }
                  className="min-h-[80px] max-h-[150px] resize-none"
                  disabled={loading}
                />
                
                {/* Character count and suggestions */}
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-muted-foreground">
                    {input.length > 0 && `${input.length} characters`}
                  </div>
                  
                  {input.length === 0 && messages.length === 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      <span>Try a quick action above</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  size="lg"
                  className="px-6"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Disclaimer */}
            <div className="text-xs text-muted-foreground text-center border-t pt-2">
              <p className="flex items-center justify-center gap-1">
                <Shield className="h-3 w-3" />
                AI responses are for guidance only. Always verify legal advice with qualified professionals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};