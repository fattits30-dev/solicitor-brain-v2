// Test for typed API client
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { typedApiClient, ApiError } from '../typed-api-client';
import type { AiChatRequest, AiChatResponse, AiDraftRequest } from '../../../../shared/api-types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TypedApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('AI Chat', () => {
    it('should make a typed AI chat request', async () => {
      const mockResponse: AiChatResponse = {
        response: 'Hello, how can I help?',
        content: 'Hello, how can I help?',
        model: 'llama3.2',
        confidence: 0.95,
        processingTime: 1500,
        timestamp: '2024-01-01T12:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: { get: () => 'application/json' },
      });

      const request: AiChatRequest = {
        message: 'Hello',
        context: { mode: 'general' },
        stream: false,
      };

      const result = await typedApiClient.chatWithAI(request);

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat', {
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify(request),
      });

      expect(result).toEqual(mockResponse);
      expect(result.confidence).toBe(0.95);
      expect(result.processingTime).toBe(1500);
    });

    it('should handle validation errors properly', async () => {
      const errorResponse = {
        success: false,
        error: 'Validation failed',
        validationErrors: [
          { field: 'message', message: 'Message is required', code: 'required' },
        ],
        timestamp: '2024-01-01T12:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse,
        headers: { get: () => 'application/json' },
      });

      const request: AiChatRequest = {
        message: '',
        context: { mode: 'general' },
        stream: false,
      };

      await expect(typedApiClient.chatWithAI(request)).rejects.toThrow(ApiError);

      try {
        await typedApiClient.chatWithAI(request);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.isValidationError()).toBe(true);
          expect(error.getValidationErrors()).toContain('message: Message is required');
        }
      }
    });
  });

  describe('Draft Generation', () => {
    it('should generate a draft with proper typing', async () => {
      const mockResponse = {
        content: 'Generated legal draft content...',
        template: 'Employment Contract',
        confidence: 0.88,
        processingTime: 2500,
        metadata: {
          wordCount: 450,
          estimated_reading_time: 3,
          tone: 'formal',
          template_used: 'Employment Contract',
        },
        timestamp: '2024-01-01T12:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: { get: () => 'application/json' },
      });

      const request: AiDraftRequest = {
        template: 'Employment Contract',
        data: { employeeName: 'John Doe', position: 'Developer' },
        options: { tone: 'formal', length: 'medium' },
      };

      const result = await typedApiClient.generateDraft(request);

      expect(result.content).toBe('Generated legal draft content...');
      expect(result.metadata?.wordCount).toBe(450);
      expect(result.metadata?.tone).toBe('formal');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      const request: AiChatRequest = {
        message: 'Hello',
        context: { mode: 'general' },
        stream: false,
      };

      await expect(typedApiClient.chatWithAI(request)).rejects.toThrow('Network error');
    });

    it('should handle 401 unauthorized errors', async () => {
      localStorage.setItem('auth_token', 'invalid-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: 'Unauthorized',
          timestamp: '2024-01-01T12:00:00Z',
        }),
      });

      // Mock window.location.href
      delete (window as any).location;
      window.location = { href: '' } as any;

      const request: AiChatRequest = {
        message: 'Hello',
        context: { mode: 'general' },
        stream: false,
      };

      await expect(typedApiClient.chatWithAI(request)).rejects.toThrow('Unauthorized');
      
      // Should clear auth and redirect
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });
  });

  describe('Evidence Generation', () => {
    it('should generate evidence with proper response typing', async () => {
      const mockResponse = {
        evidence: {
          type: 'analysis',
          content: 'Evidence analysis content...',
          supporting_documents: ['doc1.pdf', 'doc2.pdf'],
          legal_precedents: [
            {
              id: '1',
              title: 'Case Law Example',
              url: 'https://example.com/case',
              type: 'case-law',
              relevance: 0.9,
            },
          ],
          strength_assessment: 'strong',
          recommendations: ['Consider additional evidence', 'Review precedents'],
        },
        confidence: 0.85,
        processingTime: 3200,
        timestamp: '2024-01-01T12:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: { get: () => 'application/json' },
      });

      const result = await typedApiClient.generateEvidence({
        caseId: '123',
        evidenceType: 'analysis',
      });

      expect(result.evidence.type).toBe('analysis');
      expect(result.evidence.strength_assessment).toBe('strong');
      expect(result.evidence.legal_precedents).toHaveLength(1);
      expect(result.confidence).toBe(0.85);
    });
  });
});