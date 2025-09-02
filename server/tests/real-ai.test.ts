import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RealAIService } from '../services/real-ai';

// Mock the entire ollama module
jest.mock('ollama', () => {
  return {
    Ollama: jest.fn().mockImplementation(() => ({
      chat: jest.fn(),
      embeddings: jest.fn(),
      list: jest.fn(),
    })),
  };
});

const { _Ollama } = require('ollama');

// Get the mock functions from the mocked module
const mockOllamaInstance = {
  chat: jest.fn() as any,
  embeddings: jest.fn() as any,
  list: jest.fn() as any,
};

describe('RealAIService', () => {
  let service: RealAIService;

  const chatResponse = {
    message: {
      content: 'Mock AI response',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock functions
    mockOllamaInstance.chat.mockClear();
    mockOllamaInstance.embeddings.mockClear();
    mockOllamaInstance.list.mockClear();

    // Create a fresh instance for each test
    service = new RealAIService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize Ollama with default host', () => {
      const { Ollama } = require('ollama');
      new RealAIService();

      expect(Ollama).toHaveBeenCalledWith({
        host: 'http://localhost:11434',
      });
    });

    it('should use custom host from environment', () => {
      process.env.OLLAMA_HOST = 'http://custom-host:8080';

      const { Ollama } = require('ollama');
      new RealAIService();

      expect(Ollama).toHaveBeenCalledWith({
        host: 'http://custom-host:8080',
      });

      delete process.env.OLLAMA_HOST;
    });
  });

  describe('chat', () => {
    beforeEach(() => {
      mockOllamaInstance.chat.mockResolvedValue(chatResponse);
    });

    it('should send chat message and return response', async () => {
      const message = 'Hello, AI!';
      const result = await service.chat(message);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith({
        model: 'llama3.2:latest',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('helpful legal assistant'),
          },
          {
            role: 'user',
            content: message,
          },
        ],
        stream: false,
      });

      expect(result).toBe('Mock AI response');
    });

    it('should use mistral model when specified', async () => {
      const context = { model: 'mistral' };
      await service.chat('Test message', context);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mistral:7b',
        })
      );
    });

    it('should use legal mode system prompt', async () => {
      const context = { mode: 'legal' };
      await service.chat('Legal question', context);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('detailed legal analysis'),
            }),
          ]),
        })
      );
    });

    it('should use draft mode system prompt', async () => {
      const context = { mode: 'draft' };
      await service.chat('Draft request', context);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('drafting professional legal documents'),
            }),
          ]),
        })
      );
    });

    it('should build contextual message with case ID', async () => {
      const context = { caseId: 'CASE-123' };
      await service.chat('Message', context);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('[Case ID: CASE-123]'),
            }),
          ]),
        })
      );
    });

    it('should build contextual message with document ID', async () => {
      const context = { documentId: 'DOC-456' };
      await service.chat('Message', context);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('[Document Context Available]'),
            }),
          ]),
        })
      );
    });

    it('should build contextual message with attached files', async () => {
      const context = {
        attachedFiles: [
          { name: 'contract.pdf' },
          { name: 'evidence.docx' },
        ],
      };
      await service.chat('Message', context);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('[Attached Files: contract.pdf, evidence.docx]'),
            }),
          ]),
        })
      );
    });

    it('should handle chat errors', async () => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));

      await expect(service.chat('Test')).rejects.toThrow('AI service temporarily unavailable');
    });
  });

  describe('chatStream', () => {
    beforeEach(() => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));
    });

    it('should handle streaming chat', async () => {
      const onChunk = jest.fn();
      const result = await service.chatStream('Test message', { onChunk });

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
        })
      );

      expect(onChunk).toHaveBeenCalledWith('Hello');
      expect(onChunk).toHaveBeenCalledWith(' World');
      expect(result).toBe('Hello World');
    });

    it('should handle streaming errors', async () => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));

      await expect(service.chatStream('Test')).rejects.toThrow('AI streaming service temporarily unavailable');
    });
  });

  describe('generateEmbedding', () => {
    beforeEach(() => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));
    });

    it('should generate embeddings for text', async () => {
      const text = 'Sample text for embedding';
      const result = await service.generateEmbedding(text);

      expect(mockOllamaInstance.embeddings).toHaveBeenCalledWith({
        model: 'nomic-embed-text:latest',
        prompt: text,
      });

      expect(result).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should handle embedding errors', async () => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));

      await expect(service.generateEmbedding('test')).rejects.toThrow('Embedding generation failed');
    });
  });

  describe('analyzeDocument', () => {
    beforeEach(() => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));
    });

    it('should analyze document content', async () => {
      const content = 'Legal document content here...';
      const result = await service.analyzeDocument(content);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Analyze this legal document'),
            }),
          ]),
        })
      );

      expect(result).toEqual({
        analysis: 'Mock AI response',
        timestamp: expect.any(String),
      });
    });

    it('should truncate long documents', async () => {
      const longContent = 'a'.repeat(4000);
      await service.analyzeDocument(longContent);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('a'.repeat(3000)),
            }),
          ]),
        })
      );
    });

    it('should handle analysis errors', async () => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));

      await expect(service.analyzeDocument('test')).rejects.toThrow('Document analysis failed');
    });
  });

  describe('generateDraft', () => {
    beforeEach(() => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));
    });

    it('should generate document draft', async () => {
      const template = 'Legal document template';
      const data = { clientName: 'John Doe', caseType: 'Contract Dispute' };

      const result = await service.generateDraft(template, data);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Generate a professional legal document'),
            }),
          ]),
        })
      );

      expect(result).toBe('Mock AI response');
    });

    it('should handle draft generation errors', async () => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));

      await expect(service.generateDraft('template', {})).rejects.toThrow('Draft generation failed');
    });
  });

  describe('summarize', () => {
    beforeEach(() => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));
    });

    it('should summarize text', async () => {
      const text = 'Long legal text to summarize...';
      const result = await service.summarize(text);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Summarize this legal text in 3-5 bullet points'),
            }),
          ]),
        })
      );

      expect(result).toBe('Mock AI response');
    });

    it('should truncate long text for summarization', async () => {
      const longText = 'a'.repeat(3000);
      await service.summarize(longText);

      expect(mockOllamaInstance.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('a'.repeat(2000)),
            }),
          ]),
        })
      );
    });

    it('should handle summarization errors', async () => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));

      await expect(service.summarize('test')).rejects.toThrow('Summarization failed');
    });
  });

  describe('listModels', () => {
    beforeEach(() => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));
    });

    it('should list available models', async () => {
      const result = await service.listModels();

      expect(mockOllamaInstance.list).toHaveBeenCalled();
      expect(result).toEqual([
        {
          name: 'llama3.2:latest',
          size: 1000000,
          modified_at: '2024-01-01T00:00:00Z',
          digest: 'abc123',
        },
        {
          name: 'nomic-embed-text:latest',
          size: 500000,
          modified_at: '2024-01-01T00:00:00Z',
          digest: 'def456',
        },
      ]);
    });

    it('should handle list models errors', async () => {
      mockOllamaInstance.chat.mockRejectedValue(new Error('Ollama error'));

      await expect(service.listModels()).rejects.toThrow('Failed to list models');
    });
  });
});
