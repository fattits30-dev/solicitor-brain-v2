import { Bot, FileText, Loader2, PenTool, Scale, Search, Send, Shield, Users } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface Agent {
  id: string;
  name: string;
  model: string;
  role: string;
  status: string;
  icon: React.ReactNode;
}

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Legal AI Agent System ready. Type your legal query or select an agent.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('chief');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agentIcons: Record<string, React.ReactNode> = {
    chief: <Scale className="w-5 h-5" />,
    research: <Search className="w-5 h-5" />,
    document: <FileText className="w-5 h-5" />,
    compliance: <Shield className="w-5 h-5" />,
    generator: <PenTool className="w-5 h-5" />,
    liaison: <Users className="w-5 h-5" />,
  };

  useEffect(() => {
    fetchAgentStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchAgentStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/agents/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      const agentsWithIcons =
        data.agents?.map((agent: any) => ({
          ...agent,
          icon: agentIcons[agent.id] || <Bot className="w-5 h-5" />,
        })) || [];

      setAgents(agentsWithIcons);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add loading message
    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      agent: agents.find((a) => a.id === selectedAgent)?.name,
      timestamp: new Date(),
      isLoading: true,
    };
    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const token = localStorage.getItem('auth_token');
      let endpoint = '/api/agents/chat';
      let body: any = { message: input };

      // Route to specific agent endpoints
      if (selectedAgent === 'research') {
        endpoint = '/api/agents/research';
        body = { query: input };
      } else if (selectedAgent === 'generator') {
        endpoint = '/api/agents/generate-document';
        body = { documentType: 'letter', data: { content: input } };
      } else if (selectedAgent === 'compliance') {
        endpoint = '/api/agents/compliance';
        body = { checkType: 'gdpr', data: { description: input } };
      } else if (selectedAgent === 'chief') {
        endpoint = '/api/agents/analyze-case';
        body = { caseData: { description: input } };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      // Remove loading message
      setMessages((prev) => prev.filter((m) => !m.isLoading));

      // Format response based on agent
      let responseContent = '';
      if (selectedAgent === 'chief' && data.chiefAnalysis) {
        responseContent = data.chiefAnalysis.result || 'Analysis complete.';
      } else if (selectedAgent === 'research' && data.research) {
        responseContent = data.research.result || 'Research complete.';
      } else if (data.response) {
        responseContent = data.response;
      } else if (data.document) {
        responseContent = `Document generated: ${data.document.result || 'Complete'}`;
      } else if (data.compliant !== undefined) {
        responseContent = `Compliance Check: ${data.compliant ? '✅ Compliant' : '⚠️ Issues Found'}
${data.recommendations?.join('\n') || ''}`;
      } else {
        responseContent = JSON.stringify(data, null, 2);
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: responseContent,
        agent: agents.find((a) => a.id === selectedAgent)?.name,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => prev.filter((m) => !m.isLoading));

      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: 'Failed to get response. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Agent Selection Bar */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center space-x-2 overflow-x-auto">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                selectedAgent === agent.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {agent.icon}
              <span className="text-sm font-medium">{agent.name}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Selected: {agents.find((a) => a.id === selectedAgent)?.role || 'Loading...'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.role === 'system'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-white border'
              }`}
            >
              {message.agent && (
                <div className="flex items-center space-x-2 mb-2 text-sm opacity-75">
                  <Bot className="w-4 h-4" />
                  <span>{message.agent}</span>
                </div>
              )}
              {message.isLoading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
              <div className="text-xs mt-2 opacity-50">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a legal question or describe your case..."
            className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
};

export default AIChat;
