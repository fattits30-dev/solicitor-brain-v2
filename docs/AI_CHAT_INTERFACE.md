# AI Chat Interface Documentation

## Overview

The AI Chat Interface is a comprehensive, trauma-informed conversational assistant designed specifically for UK legal professionals using the Solicitor Brain v2 system. It provides intelligent legal assistance while maintaining the highest standards of accessibility, privacy, and professional ethics.

## Key Features

### 🤖 Intelligent Conversation Management
- **Multi-conversation support**: Create, manage, and switch between multiple AI conversations
- **Persistent history**: Conversations are automatically saved to localStorage with full context
- **Smart context awareness**: AI maintains context from case files, attached documents, and conversation history
- **Confidence scoring**: Each AI response includes confidence levels with visual indicators

### 📝 Specialized Legal Modes
- **General Mode**: Broad legal assistance and general inquiries
- **Legal Analysis Mode**: Deep dive into legal issues, case law, and statutory analysis
- **Document Drafting Mode**: Specialized assistance for creating legal documents and correspondence

### 💬 Enhanced Chat Experience
- **Real-time streaming**: Responses stream in real-time for better user experience
- **Typing indicators**: Visual feedback showing when the AI is processing
- **Message actions**: Copy, star, provide feedback, and export responses
- **Quick actions**: Pre-configured prompts for common legal tasks

### 📎 Document Integration
- **File attachment**: Attach documents (PDF, DOC, DOCX, TXT, JSON) for AI analysis
- **Context integration**: AI considers attached files in responses
- **Document preview**: View attached files with size information
- **Smart citations**: AI provides source citations with confidence scores

### ⚙️ Customizable Settings
- **Model selection**: Choose between Llama 3.2, Mistral 7B, or GPT-4
- **Streaming control**: Enable/disable real-time response streaming
- **Context management**: Control whether case and document context is included
- **Confidence thresholds**: Set warning levels for low-confidence responses

### 📊 Advanced Features
- **Export conversations**: Download chat history as JSON files
- **Conversation branching**: Star important messages and create conversation branches
- **Feedback system**: Rate AI responses to improve performance
- **Activity monitoring**: Track AI processing times and performance metrics

## Component Architecture

### Core Components

#### AIChatPanel
The main chat interface component with the following props:

```typescript
interface AIChatPanelProps {
  caseId?: string;                     // Associated case ID
  documentId?: string;                 // Associated document ID
  onGenerateDraft?: (content: string) => void;  // Callback for draft generation
  onDocumentAnalyze?: (documentId: string, analysis: string) => void;  // Document analysis callback
  className?: string;                  // Additional CSS classes
  isExpanded?: boolean;                // Expanded view state
  onToggleExpand?: () => void;         // Expand/minimize callback
}
```

#### Key State Management

```typescript
// Conversation Management
const [conversations, setConversations] = useState<Conversation[]>([]);
const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
const [messages, setMessages] = useState<Message[]>([]);

// UI Configuration
const [selectedModel, setSelectedModel] = useState<'llama3' | 'mistral' | 'gpt4'>('llama3');
const [chatMode, setChatMode] = useState<'general' | 'legal' | 'draft'>('general');
const [streamingEnabled, setStreamingEnabled] = useState(true);

// File Management
const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
```

### Data Structures

#### Message Interface
```typescript
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
}
```

#### Conversation Interface
```typescript
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
```

## API Integration

### Enhanced Chat Endpoint
```
POST /api/ai/chat
```

**Request Body:**
```json
{
  "message": "User's message text",
  "model": "llama3" | "mistral" | "gpt4",
  "mode": "general" | "legal" | "draft",
  "stream": true | false,
  "context": {
    "caseId": "string",
    "documentId": "string",
    "attachedFiles": [
      {
        "id": "string",
        "name": "string",
        "type": "string"
      }
    ],
    "previousMessages": [...] // Last 5 messages for context
  }
}
```

**Response (Non-streaming):**
```json
{
  "response": "AI response text",
  "content": "AI response text",
  "model": "llama3.2",
  "confidence": 0.85,
  "processingTime": 2500,
  "timestamp": "2023-08-31T18:30:00.000Z"
}
```

**Response (Streaming):**
```
Content-Type: text/plain
Transfer-Encoding: chunked

[Streaming text chunks...]
```

## Quick Actions

The interface includes pre-configured quick actions for common legal tasks:

### Legal Analysis Mode
- **Summarize Case**: Comprehensive case overview with key facts and issues
- **Identify Legal Issues**: Analysis of claims, defenses, and procedural considerations
- **Compliance Review**: UK legal requirements and limitation periods review
- **Timeline Analysis**: Chronological event timeline with critical dates
- **Risk Assessment**: Success likelihood, costs, and strategy recommendations

### Document Drafting Mode
- **Draft Response Letter**: Professional correspondence with empathetic tone
- **Create Legal Documents**: Templates for various legal document types
- **Generate Contracts**: Contract drafting assistance
- **Compliance Documents**: Regulatory and compliance document creation

## Accessibility & UX

### Trauma-Informed Design
- **Clear Language**: Plain English explanations with legal precision
- **User Control**: "You control this action" messaging throughout
- **Consent Gates**: Clear warnings before sensitive operations
- **Empathetic Tone**: Professional yet understanding communication style

### WCAG 2.2 AA Compliance
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Proper ARIA labels and semantic markup
- **Color Contrast**: High contrast ratios for all text and UI elements
- **Focus Management**: Logical tab order and visible focus indicators

### Responsive Design
- **Mobile-First**: Works seamlessly on all device sizes
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Adaptive Layout**: UI adjusts based on screen size and orientation

## Privacy & Security

### Data Protection
- **PII Redaction**: Automatic removal of personally identifiable information
- **Local Storage**: Conversations stored locally, not on servers
- **Encryption**: All API communications use HTTPS
- **Session Management**: Secure token-based authentication

### Professional Disclaimers
- **Guidance Only**: Clear messaging that AI provides guidance, not legal advice
- **Professional Verification**: Recommendations to verify with qualified professionals
- **Limitation Notices**: Clear boundaries on AI capabilities and limitations

## Configuration

### Environment Variables
```bash
# AI Service Configuration
OLLAMA_HOST=http://localhost:11434
ENABLE_AI_FEATURES=true

# Model Configuration
DEFAULT_CHAT_MODEL=llama3.2:latest
DEFAULT_EMBED_MODEL=nomic-embed-text:latest
```

### Model Settings
- **Llama 3.2**: Recommended for most legal tasks (default)
- **Mistral 7B**: Alternative model for varied perspectives
- **GPT-4**: Premium option for complex analysis (requires API key)

## Performance Optimization

### Response Streaming
- **Real-time Updates**: Responses stream for immediate feedback
- **Chunked Processing**: Large responses processed in manageable chunks
- **Connection Management**: Proper WebSocket-like streaming handling

### Caching Strategy
- **Conversation Persistence**: Local storage for conversation history
- **Context Optimization**: Smart context pruning to maintain performance
- **Model Caching**: Efficient model loading and reuse

## Testing

### Unit Tests
- Component rendering and interaction tests
- State management validation
- API integration testing
- Accessibility compliance verification

### Integration Tests
- End-to-end conversation flows
- File attachment and processing
- Multi-conversation management
- Export/import functionality

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint and Prettier configuration
- Component-based architecture
- Comprehensive type definitions

### Best Practices
- **Performance**: Lazy loading and code splitting
- **Maintainability**: Clear component boundaries and interfaces
- **Testing**: High test coverage with meaningful assertions
- **Documentation**: Comprehensive inline and external documentation

## Troubleshooting

### Common Issues

#### AI Service Unavailable
```
Error: AI service temporarily unavailable
```
**Solution**: Check Ollama service status and connection

#### Streaming Errors
```
Error: AI streaming service temporarily unavailable
```
**Solution**: Disable streaming in settings or check network connection

#### File Upload Issues
```
Error: File size exceeds limit
```
**Solution**: Compress files or use smaller attachments

### Debug Mode
Enable verbose logging by setting:
```javascript
localStorage.setItem('ai-chat-debug', 'true');
```

## Future Enhancements

### Planned Features
- **Voice Input/Output**: Speech-to-text and text-to-speech integration
- **Advanced Search**: Full-text search across conversation history
- **Conversation Templates**: Pre-configured conversation starters
- **Integration Hub**: Connect with external legal databases
- **Multi-language Support**: Support for Welsh and other languages

### API Enhancements
- **Webhook Support**: Real-time notifications for long-running processes
- **Batch Processing**: Handle multiple requests simultaneously
- **Analytics Integration**: Usage tracking and performance metrics
- **Custom Model Training**: Fine-tune models on firm-specific data

## Support

For technical support or feature requests, please:
1. Check this documentation first
2. Review the troubleshooting section
3. Submit issues via the project repository
4. Contact the development team for urgent matters

---

**Last Updated**: August 31, 2025
**Version**: 2.0.0
**Component**: AI Chat Interface