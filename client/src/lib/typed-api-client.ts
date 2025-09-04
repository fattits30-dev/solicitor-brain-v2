// Enhanced Type-Safe API Client for Solicitor Brain v2
// This provides full type safety for all API calls

import { 
  ApiResponse, 
  ApiSuccessResponse as _ApiSuccessResponse,
  ApiErrorResponse,
  ApiValidationErrorResponse,
  AiChatRequest,
  AiChatResponse,
  DocumentAnalysisRequest,
  AiDocumentAnalysisResponse,
  AiDraftRequest,
  AiDraftResponse,
  AiEvidenceRequest,
  AiEvidenceResponse,
  AiSummarizationResponse,
  AiModelsResponse,
  LegalResearchRequest,
  LegalResearchResponse,
  CitationVerificationResponse,
  AiActivityResponse,
  isApiSuccessResponse,
  isApiErrorResponse,
  isValidationErrorResponse
} from '../../../shared/api-types';

interface TypedFetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

export class TypedApiClient {
  private baseURL = '';

  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async request<TResponse>(
    endpoint: string,
    options: TypedFetchOptions = {}
  ): Promise<TResponse> {
    const { requiresAuth = true, ...fetchOptions } = options;

    const headers = new Headers(fetchOptions.headers);

    // Add content type if not present
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    // Add auth header if required
    if (requiresAuth) {
      const token = this.getAuthToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    // Handle 401 Unauthorized
    if (response.status === 401 && requiresAuth) {
      // Clear auth and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let errorData: ApiErrorResponse;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }
      
      const error = new Error(errorData.error);
      (error as any).response = errorData;
      (error as any).status = response.status;
      throw error;
    }

    // Return typed response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }

    return response.text() as TResponse;
  }

  // Type-safe AI endpoints

  async chatWithAI(request: AiChatRequest): Promise<AiChatResponse> {
    return this.request<AiChatResponse>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async chatWithAIEnhanced(request: AiChatRequest): Promise<AiChatResponse> {
    return this.request<AiChatResponse>('/api/ai/chat-enhanced', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<AiDocumentAnalysisResponse> {
    return this.request<AiDocumentAnalysisResponse>('/api/ai/analyze-document', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async generateDraft(request: AiDraftRequest): Promise<AiDraftResponse> {
    return this.request<AiDraftResponse>('/api/ai/generate-draft', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async summarizeText(text: string): Promise<AiSummarizationResponse> {
    return this.request<AiSummarizationResponse>('/api/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async generateEvidence(request: AiEvidenceRequest): Promise<AiEvidenceResponse> {
    return this.request<AiEvidenceResponse>('/api/ai/generate-evidence', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getAIModels(): Promise<AiModelsResponse> {
    return this.request<AiModelsResponse>('/api/ai/models', {
      method: 'GET',
    });
  }

  async legalResearch(request: LegalResearchRequest): Promise<LegalResearchResponse> {
    return this.request<LegalResearchResponse>('/api/ai/legal-research', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async verifyCitations(text: string): Promise<CitationVerificationResponse> {
    return this.request<CitationVerificationResponse>('/api/ai/verify-citations', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async researchCompany(companyIdentifier: string): Promise<any> {
    return this.request('/api/ai/research-company', {
      method: 'POST',
      body: JSON.stringify({ companyIdentifier }),
    });
  }

  async getAIActivity(): Promise<AiActivityResponse> {
    return this.request<AiActivityResponse>('/api/ai/activity', {
      method: 'GET',
    });
  }

  // Generic methods for other endpoints
  async get<T>(endpoint: string, options?: TypedFetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  async post<T>(endpoint: string, data?: any, options?: TypedFetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options?: TypedFetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: TypedFetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  async patch<T>(endpoint: string, data?: any, options?: TypedFetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Export singleton instance
export const typedApiClient = new TypedApiClient();

// React Query integration helpers
export const createTypedQueryKey = <T extends Record<string, any>>(
  endpoint: string,
  params?: T
): [string, T?] => {
  return params ? [endpoint, params] : [endpoint];
};

// Error handling utilities
export class ApiError extends Error {
  public readonly response?: ApiErrorResponse;
  public readonly status?: number;
  public readonly validationErrors?: ApiValidationErrorResponse['validationErrors'];

  constructor(message: string, response?: ApiErrorResponse, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.response = response;
    this.status = status;
    
    if (response && isValidationErrorResponse(response)) {
      this.validationErrors = response.validationErrors;
    }
  }

  public isValidationError(): boolean {
    return Boolean(this.validationErrors);
  }

  public getValidationErrors(): string[] {
    return this.validationErrors?.map(err => `${err.field}: ${err.message}`) || [];
  }
}

// Utility functions for handling API responses
export function handleApiResponse<T>(
  response: ApiResponse<T>
): T {
  if (isApiSuccessResponse(response)) {
    return response.data;
  }

  if (isApiErrorResponse(response)) {
    throw new ApiError(response.error, response);
  }

  // Fallback for legacy responses that don't follow the standard format
  return response as T;
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes('fetch');
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isValidationError(error: unknown): boolean {
  return error instanceof ApiError && error.isValidationError();
}

// React Query integration
export const typedQueryFetcher = <T>(url: string): Promise<T> => 
  typedApiClient.get<T>(url);

// Streaming support for AI chat
export async function* streamAIChat(request: AiChatRequest): AsyncGenerator<string, void, unknown> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}