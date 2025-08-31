import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Settings
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  context?: {
    documentId?: string;
    caseId?: string;
    citations?: Array<{
      source: string;
      page?: number;
      confidence: number;
    }>;
  };
  feedback?: 'positive' | 'negative';
}

interface AIChatPanelProps {
  caseId?: string;
  documentId?: string;
  onGenerateDraft?: (content: string) => void;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  caseId,
  documentId,
  onGenerateDraft
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'llama3' | 'mistral' | 'gpt4'>('llama3');
  const [streamingResponse, setStreamingResponse] = useState('');
  const [contextEnabled, setContextEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatMode, setChatMode] = useState<'general' | 'legal' | 'draft'>('general');

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingResponse]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      context: contextEnabled ? { caseId, documentId } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStreamingResponse('');

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          model: selectedModel,
          mode: chatMode,
          context: contextEnabled ? {
            caseId,
            documentId,
            previousMessages: messages.slice(-5)
          } : undefined
        })
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          fullResponse += chunk;
          setStreamingResponse(fullResponse);
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date(),
        model: selectedModel,
        context: contextEnabled ? { caseId, documentId } : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingResponse('');
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback } : msg
    ));
  };

  const handleReset = () => {
    setMessages([]);
    setStreamingResponse('');
  };

  const handleGenerateDraft = (content: string) => {
    onGenerateDraft?.(content);
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'legal':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'legal':
        return <FileText className="h-3 w-3" />;
      case 'draft':
        return <Sparkles className="h-3 w-3" />;
      default:
        return <Brain className="h-3 w-3" />;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getModeColor(chatMode)}>
              {getModeIcon(chatMode)}
              <span className="ml-1 capitalize">{chatMode}</span>
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              title="Clear chat"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Mode Selector */}
        <Tabs value={chatMode} onValueChange={(v) => setChatMode(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">
              <Brain className="h-3 w-3 mr-1" />
              General
            </TabsTrigger>
            <TabsTrigger value="legal">
              <FileText className="h-3 w-3 mr-1" />
              Legal
            </TabsTrigger>
            <TabsTrigger value="draft">
              <Sparkles className="h-3 w-3 mr-1" />
              Drafting
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.length === 0 && !streamingResponse ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                {chatMode === 'legal' 
                  ? 'Ask legal questions about your case or documents'
                  : chatMode === 'draft'
                  ? 'Get help drafting legal documents and letters'
                  : 'How can I assist you today?'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => setInput('Summarize this case')}
                >
                  Summarize case
                </Badge>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => setInput('What are the key legal issues?')}
                >
                  Key issues
                </Badge>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => setInput('Draft a response letter')}
                >
                  Draft letter
                </Badge>
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
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <Settings className="h-4 w-4 text-orange-600" />
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'ml-auto' : ''}`}>
                    <div
                      className={`rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : message.role === 'system'
                          ? 'bg-orange-50 border border-orange-200'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {/* Citations */}
                      {message.context?.citations && message.context.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/20">
                          <p className="text-xs opacity-75 mb-1">Sources:</p>
                          <div className="flex flex-wrap gap-1">
                            {message.context.citations.map((citation, idx) => (
                              <Badge 
                                key={idx} 
                                variant="secondary" 
                                className="text-xs"
                              >
                                {citation.source}
                                {citation.page && ` p.${citation.page}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Message Actions */}
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleCopyMessage(message.content)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        {chatMode === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleGenerateDraft(message.content)}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Use as Draft
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleFeedback(message.id, 'positive')}
                        >
                          <ThumbsUp className={`h-3 w-3 ${message.feedback === 'positive' ? 'text-green-600' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleFeedback(message.id, 'negative')}
                        >
                          <ThumbsDown className={`h-3 w-3 ${message.feedback === 'negative' ? 'text-red-600' : ''}`} />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Streaming Response */}
              {streamingResponse && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="flex-1 max-w-[80%]">
                    <div className="rounded-lg p-3 bg-muted">
                      <p className="text-sm whitespace-pre-wrap">{streamingResponse}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as any)}
              className="text-xs border rounded px-2 py-1"
              disabled={loading}
            >
              <option value="llama3">Llama 3</option>
              <option value="mistral">Mistral</option>
              <option value="gpt4">GPT-4</option>
            </select>
            <label className="flex items-center gap-1 ml-auto">
              <input
                type="checkbox"
                checked={contextEnabled}
                onChange={(e) => setContextEnabled(e.target.checked)}
                disabled={loading}
              />
              <span className="text-muted-foreground">Include context</span>
            </label>
          </div>
          
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Ask ${chatMode === 'legal' ? 'a legal question' : chatMode === 'draft' ? 'for help drafting' : 'anything'}...`}
              className="min-h-[60px] max-h-[120px] resize-none"
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-4"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};