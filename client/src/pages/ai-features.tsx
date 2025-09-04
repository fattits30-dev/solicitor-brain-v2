import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  Copy,
  Download,
  Eye,
  FileSignature,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Send,
  Settings,
  Share2,
  Sparkles,
  StopCircle,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import { useToast } from '@/hooks/use-toast';
import type { Case } from '@shared/schema';

interface AIChat {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
  caseId?: string;
  documentIds?: string[];
  type: 'general' | 'case-specific' | 'document-analysis' | 'legal-research';
}

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    sources?: Array<{
      id: string;
      title: string;
      type: 'document' | 'case-law' | 'statute';
      relevance: number;
    }>;
    confidence?: number;
    processingTime?: number;
    tokens?: number;
  };
  feedback?: 'helpful' | 'not_helpful';
}

interface AITask {
  id: string;
  type:
    | 'document-summary'
    | 'legal-research'
    | 'draft-generation'
    | 'contract-analysis'
    | 'risk-assessment';
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  result?: any;
  error?: string;
  caseId?: string;
  documentIds?: string[];
}

interface AIInsight {
  id: string;
  type: 'risk-alert' | 'deadline-reminder' | 'pattern-detection' | 'recommendation';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  source: string;
  actionRequired: boolean;
  createdAt: string;
  caseId?: string;
  documentId?: string;
}

export default function AIFeaturesPage() {
  const { toast } = useToast();

  // State management
  const [activeChat, setActiveChat] = useState<AIChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('all');
  const [aiModel, setAiModel] = useState('llama3.2:3b');
  const [voiceInput, setVoiceInput] = useState(false);

  // Query for AI chats
  const {
    data: chats = [],
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = useQuery<AIChat[]>({
    queryKey: ['/api/ai/chats', selectedCaseId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCaseId !== 'all') params.append('caseId', selectedCaseId);

      const response = await fetch(`/api/ai/chats?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI chats');
      }

      return response.json();
    },
  });

  // Query for AI tasks
  const { data: tasks = [] } = useQuery<AITask[]>({
    queryKey: ['/api/ai/tasks'],
    queryFn: async () => {
      const response = await fetch('/api/ai/tasks', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI tasks');
      }

      return response.json();
    },
  });

  // Query for AI insights
  const { data: insights = [] } = useQuery<AIInsight[]>({
    queryKey: ['/api/ai/insights'],
    queryFn: async () => {
      const response = await fetch('/api/ai/insights', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI insights');
      }

      return response.json();
    },
  });

  // Query for cases
  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
    queryFn: async () => {
      const response = await fetch('/api/cases', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }

      return response.json();
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, message }: { chatId: string; message: string }) => {
      const response = await fetch(`/api/ai/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          content: message,
          model: aiModel,
          caseId: selectedCaseId !== 'all' ? selectedCaseId : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      refetchChats();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send message to AI.',
        variant: 'destructive',
      });
    },
  });

  // Create new chat mutation
  const createChatMutation = useMutation({
    mutationFn: async ({
      title,
      type,
      caseId,
    }: {
      title: string;
      type: AIChat['type'];
      caseId?: string;
    }) => {
      const response = await fetch('/api/ai/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          title,
          type,
          caseId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create chat');
      }

      return response.json();
    },
    onSuccess: (newChat) => {
      setActiveChat(newChat);
      refetchChats();
      toast({
        title: 'Chat created',
        description: 'New AI chat session started.',
      });
    },
  });

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;

    setIsTyping(true);
    try {
      await sendMessageMutation.mutateAsync({
        chatId: activeChat.id,
        message: newMessage.trim(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleCreateNewChat = () => {
    createChatMutation.mutate({
      title: 'New Chat',
      type: 'general',
      caseId: selectedCaseId !== 'all' ? selectedCaseId : undefined,
    });
  };

  const getInsightSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="AI Features"
          subtitle="Advanced AI-powered legal assistance and automation"
        />
        <div className="flex-1 overflow-hidden">
          <div className="h-full p-6 space-y-6">
            {/* AI Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Active Chats</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">{chats.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Tasks Running</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {tasks.filter((t) => t.status === 'processing').length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Insights</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">{insights.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Completion Rate</span>
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {tasks.length > 0
                      ? Math.round(
                          (tasks.filter((t) => t.status === 'completed').length / tasks.length) *
                            100,
                        )
                      : 0}
                    %
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main AI Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
              {/* Left Panel - Chat List & Controls */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Brain className="h-5 w-5" />
                        <span>AI Assistant</span>
                      </CardTitle>
                      <Button size="sm" onClick={handleCreateNewChat}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        New Chat
                      </Button>
                    </div>
                    <CardDescription>
                      Start conversations with AI for legal assistance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Case Filter */}
                    <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by case" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Cases</SelectItem>
                        {cases.map((case_) => (
                          <SelectItem key={case_.id} value={case_.id.toString()}>
                            {case_.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* AI Model Selection */}
                    <Select value={aiModel} onValueChange={setAiModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="llama3.2:3b">Llama 3.2 (3B) - Fast</SelectItem>
                        <SelectItem value="llama3.2:1b">Llama 3.2 (1B) - Fastest</SelectItem>
                        <SelectItem value="gpt-4">GPT-4 - Most Capable</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Chat List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Recent Chats</span>
                        <Button variant="ghost" size="sm">
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                      {chatsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : chats.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No chats yet. Start a new conversation!
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {chats.map((chat) => (
                            <Button
                              key={chat.id}
                              variant={activeChat?.id === chat.id ? 'secondary' : 'ghost'}
                              className="w-full justify-start text-left p-2 h-auto"
                              onClick={() => setActiveChat(chat)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    {chat.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimestamp(chat.updatedAt)}
                                  </span>
                                </div>
                                <div className="font-medium truncate mt-1">{chat.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {chat.messages.length} messages
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* AI Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Sparkles className="h-5 w-5" />
                      <span>AI Insights</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {insights.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No insights available
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {insights.slice(0, 5).map((insight) => (
                          <div key={insight.id} className="border rounded-lg p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <div
                                    className={`w-2 h-2 rounded-full ${getInsightSeverityColor(insight.severity)}`}
                                  />
                                  <span className="font-medium text-sm">{insight.title}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {insight.description}
                                </p>
                                <div className="flex items-center space-x-2 mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {Math.round(insight.confidence * 100)}% confident
                                  </Badge>
                                  {insight.actionRequired && (
                                    <Badge variant="destructive" className="text-xs">
                                      Action Required
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Center Panel - Active Chat */}
              <div className="lg:col-span-2">
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Bot className="h-5 w-5" />
                        <CardTitle>{activeChat ? activeChat.title : 'Select a chat'}</CardTitle>
                        {activeChat && <Badge variant="outline">{activeChat.type}</Badge>}
                      </div>
                      {activeChat && (
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share Chat
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Export Chat
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Chat
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  {activeChat ? (
                    <>
                      <CardContent className="flex-1 overflow-hidden">
                        <div className="h-full flex flex-col">
                          {/* Messages */}
                          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {activeChat.messages.length === 0 ? (
                              <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center">
                                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                  <p>Start a conversation with the AI assistant</p>
                                  <p className="text-sm mt-1">
                                    Ask legal questions, request document analysis, or generate
                                    drafts
                                  </p>
                                </div>
                              </div>
                            ) : (
                              activeChat.messages.map((message) => (
                                <div
                                  key={message.id}
                                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-lg p-3 ${
                                      message.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                    }`}
                                  >
                                    <div className="space-y-2">
                                      <p className="text-sm">{message.content}</p>

                                      {/* Message metadata */}
                                      {message.metadata && (
                                        <div className="space-y-2 text-xs opacity-75">
                                          {message.metadata.sources && (
                                            <div>
                                              <span className="font-medium">Sources:</span>
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {message.metadata.sources.map((source, idx) => (
                                                  <Badge
                                                    key={idx}
                                                    variant="secondary"
                                                    className="text-xs"
                                                  >
                                                    {source.title}
                                                  </Badge>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {message.metadata.confidence && (
                                            <div>
                                              <span className="font-medium">Confidence:</span>{' '}
                                              {Math.round(message.metadata.confidence * 100)}%
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      <div className="flex items-center justify-between">
                                        <span className="text-xs opacity-50">
                                          {formatTimestamp(message.timestamp)}
                                        </span>
                                        {message.role === 'assistant' && (
                                          <div className="flex items-center space-x-1">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                            >
                                              <Copy className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                            >
                                              <ThumbsUp className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                            >
                                              <ThumbsDown className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}

                            {isTyping && (
                              <div className="flex justify-start">
                                <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                                  <div className="flex items-center space-x-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">AI is typing...</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Message Input */}
                          <div className="border-t pt-4 mt-4">
                            <div className="flex items-end space-x-2">
                              <div className="flex-1">
                                <Textarea
                                  placeholder="Ask the AI anything about your legal work..."
                                  value={newMessage}
                                  onChange={(e) => setNewMessage(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSendMessage();
                                    }
                                  }}
                                  className="min-h-[60px] max-h-[120px]"
                                />
                              </div>
                              <div className="flex flex-col space-y-2">
                                <Button
                                  variant={voiceInput ? 'destructive' : 'outline'}
                                  size="sm"
                                  onClick={() => setVoiceInput(!voiceInput)}
                                >
                                  {voiceInput ? (
                                    <StopCircle className="h-4 w-4" />
                                  ) : (
                                    <Mic className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  onClick={handleSendMessage}
                                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                                  size="sm"
                                >
                                  {sendMessageMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setNewMessage(
                                    'Summarize the key points from the uploaded documents.',
                                  )
                                }
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Summarize Documents
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setNewMessage('What are the potential legal risks in this case?')
                                }
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Risk Analysis
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setNewMessage(
                                    'Generate a draft contract based on the case requirements.',
                                  )
                                }
                              >
                                <FileSignature className="h-3 w-3 mr-1" />
                                Draft Generation
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setNewMessage('Research relevant case law and statutes.')
                                }
                              >
                                <BookOpen className="h-3 w-3 mr-1" />
                                Legal Research
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </>
                  ) : (
                    <CardContent className="flex-1 flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a chat to start conversing with AI</p>
                        <p className="text-sm mt-1">Create a new chat to begin</p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            </div>

            {/* AI Tasks & Status */}
            {tasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-5 w-5" />
                    <span>AI Tasks</span>
                  </CardTitle>
                  <CardDescription>Background AI processing tasks and their status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between border rounded-lg p-3"
                      >
                        <div className="flex items-center space-x-3">
                          {getTaskStatusIcon(task.status)}
                          <div>
                            <div className="font-medium text-sm">{task.title}</div>
                            <div className="text-xs text-muted-foreground">{task.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          {task.status === 'processing' && (
                            <div className="flex items-center space-x-2">
                              <Progress value={task.progress} className="w-20" />
                              <span className="text-xs">{task.progress}%</span>
                            </div>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {task.type}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
