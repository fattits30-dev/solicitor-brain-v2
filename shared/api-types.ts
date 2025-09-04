// Shared API Response Types for Solicitor Brain v2
// This file provides comprehensive type safety for all API responses

import { z } from 'zod';

// ====================
// Base Response Types
// ====================

// Base API Response
export interface BaseApiResponse {
  timestamp: string;
}

// Success Response with data
export interface ApiSuccessResponse<T = any> extends BaseApiResponse {
  success: true;
  data: T;
}

// Error Response
export interface ApiErrorResponse extends BaseApiResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
}

// Generic API Response Union
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// ====================
// AI Service Response Types
// ====================

// AI Chat Response
export interface AiChatResponse extends BaseApiResponse {
  response: string;
  content: string;
  model: string;
  confidence: number;
  processingTime: number;
  legalSources?: LegalSource[];
  verifiedCitations?: VerifiedCitation[];
  researchEnabled?: boolean;
}

// Legal Source
export interface LegalSource {
  id: string;
  title: string;
  url: string;
  type: 'statute' | 'case-law' | 'regulation' | 'guidance';
  relevance: number;
  excerpt?: string;
}

// Verified Citation
export interface VerifiedCitation {
  citation: string;
  verified: boolean;
  url?: string;
  confidence: number;
  context?: string;
}

// AI Document Analysis Response
export interface AiDocumentAnalysisResponse extends BaseApiResponse {
  summary: string;
  keyPoints: string[];
  entities: DocumentEntity[];
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  processingTime: number;
  extractedText?: string;
  metadata?: Record<string, any>;
}

// Document Entity
export interface DocumentEntity {
  type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'legal-reference';
  value: string;
  confidence: number;
  position: {
    start: number;
    end: number;
  };
}

// Draft Generation Response
export interface AiDraftResponse extends BaseApiResponse {
  content: string;
  template?: string;
  confidence: number;
  processingTime: number;
  metadata?: {
    wordCount: number;
    estimated_reading_time: number;
    tone: 'formal' | 'empathetic' | 'neutral';
    template_used?: string;
  };
}

// AI Summarization Response
export interface AiSummarizationResponse extends BaseApiResponse {
  summary: string;
  keyPoints: string[];
  confidence: number;
  processingTime: number;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
}

// Evidence Generation Response
export interface AiEvidenceResponse extends BaseApiResponse {
  evidence: {
    type: string;
    content: string;
    supporting_documents: string[];
    legal_precedents: LegalSource[];
    strength_assessment: 'strong' | 'moderate' | 'weak';
    recommendations: string[];
  };
  confidence: number;
  processingTime: number;
}

// AI Models List Response
export interface AiModelsResponse extends BaseApiResponse {
  models: AiModel[];
}

export interface AiModel {
  name: string;
  version: string;
  description: string;
  capabilities: ('chat' | 'analysis' | 'summarization' | 'generation')[];
  parameters: {
    max_tokens: number;
    context_length: number;
  };
  status: 'available' | 'loading' | 'error';
}

// Legal Research Response
export interface LegalResearchResponse extends BaseApiResponse {
  query: string;
  caseType: string;
  legalResearch: {
    relevantLegislation: LegalSource[];
    recentCases: LegalSource[];
    additionalContext: string;
  };
  companyInfo?: CompanyInfo;
  sources: string[];
}

// Company Information (from Companies House API)
export interface CompanyInfo {
  company_number: string;
  company_name: string;
  company_status: string;
  incorporation_date: string;
  company_type: string;
  registered_office_address: {
    address_line_1: string;
    address_line_2?: string;
    locality: string;
    postal_code: string;
    country: string;
  };
  officers?: CompanyOfficer[];
  sic_codes?: string[];
}

export interface CompanyOfficer {
  name: string;
  role: string;
  appointed_on: string;
  resigned_on?: string;
}

// Citation Verification Response
export interface CitationVerificationResponse extends BaseApiResponse {
  verifiedCitations: VerifiedCitation[];
  totalCitations: number;
  verifiedCount: number;
  verificationRate: number;
  source: string;
}

// AI Activity Response
export interface AiActivityResponse extends BaseApiResponse {
  activities: AiActivity[];
  total: number;
}

export interface AiActivity {
  id: string;
  description: string;
  timestamp: string;
  type: 'ocr' | 'rag' | 'draft' | 'privacy' | 'analysis';
  model: string;
  metadata?: Record<string, any>;
}

// ====================
// Chat & Conversation Types
// ====================

// Message in conversation
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
  confidence?: number;
  processingTime?: number;
  context?: MessageContext;
  feedback?: 'positive' | 'negative';
  starred?: boolean;
  exported?: boolean;
  branchPoint?: boolean;
}

// Message Context
export interface MessageContext {
  documentId?: string;
  caseId?: string;
  attachedFiles?: AttachedFile[];
  citations?: Citation[];
  legalSources?: LegalSource[];
  verifiedCitations?: VerifiedCitation[];
  researchEnabled?: boolean;
}

export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size?: number;
}

export interface Citation {
  source: string;
  page?: number;
  confidence: number;
  excerpt?: string;
}

// Conversation
export interface Conversation {
  id: string;
  title: string;
  type: 'general' | 'case-specific' | 'document-analysis' | 'legal-research';
  messages: ChatMessage[];
  metadata: ConversationMetadata;
  createdAt: string;
  updatedAt: string;
  caseId?: string;
  userId: string;
}

export interface ConversationMetadata {
  totalTokens: number;
  averageConfidence: number;
  messageCount: number;
  lastActivity: string;
  tags?: string[];
  archived?: boolean;
}

// ====================
// Case & Document Types
// ====================

// These extend the base database types with API-specific additions

export interface CaseWithEvidence {
  id: number;
  caseReference: string;
  title: string;
  status: string;
  priority: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  evidence?: AiEvidenceResponse['evidence'];
  documentCount?: number;
  lastActivity?: string;
}

// ====================
// Search & Filter Types
// ====================

export interface SearchResponse<T = any> extends BaseApiResponse {
  results: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters?: Record<string, any>;
  facets?: SearchFacet[];
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: string;
    count: number;
  }>;
}

// ====================
// Validation Schemas
// ====================

// AI Chat Request Schema
export const aiChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  context: z.object({
    caseId: z.string().optional(),
    documentId: z.string().optional(),
    mode: z.enum(['general', 'legal', 'document-analysis']).default('general'),
  }).optional(),
  stream: z.boolean().default(false),
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;

// Additional request type aliases for easier use
export type AiDraftRequest = DraftGenerationRequest;
export type AiEvidenceRequest = EvidenceGenerationRequest;

// Document Analysis Request Schema
export const documentAnalysisRequestSchema = z.object({
  content: z.string().min(1),
  options: z.object({
    extractEntities: z.boolean().default(true),
    analyzeSentiment: z.boolean().default(true),
    generateSummary: z.boolean().default(true),
  }).optional(),
});

export type DocumentAnalysisRequest = z.infer<typeof documentAnalysisRequestSchema>;

// Draft Generation Request Schema
export const draftGenerationRequestSchema = z.object({
  template: z.string().min(1),
  data: z.record(z.any()),
  options: z.object({
    tone: z.enum(['formal', 'empathetic', 'neutral']).default('formal'),
    length: z.enum(['short', 'medium', 'long']).default('medium'),
  }).optional(),
});

export type DraftGenerationRequest = z.infer<typeof draftGenerationRequestSchema>;

// Evidence Generation Request Schema
export const evidenceGenerationRequestSchema = z.object({
  caseId: z.string().min(1),
  evidenceType: z.string().default('analysis'),
});

export type EvidenceGenerationRequest = z.infer<typeof evidenceGenerationRequestSchema>;

// Legal Research Request Schema
export const legalResearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  caseType: z.string().default('general'),
  includeCompanyInfo: z.boolean().default(false),
});

export type LegalResearchRequest = z.infer<typeof legalResearchRequestSchema>;

// ====================
// Error Types
// ====================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiValidationErrorResponse extends BaseApiResponse {
  success: false;
  error: 'Validation failed';
  validationErrors: ValidationError[];
}

// ====================
// Type Guards
// ====================

export function isApiSuccessResponse<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return (response as ApiSuccessResponse<T>).success === true;
}

export function isApiErrorResponse(response: ApiResponse): response is ApiErrorResponse {
  return (response as ApiErrorResponse).success === false;
}

export function isValidationErrorResponse(response: ApiResponse): response is ApiValidationErrorResponse {
  return isApiErrorResponse(response) && response.error === 'Validation failed';
}

// ====================
// Utility Types
// ====================

// Pagination parameters
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Search parameters
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, any>;
}

// API endpoint mapping type
export type ApiEndpointMap = {
  // AI endpoints
  'POST /api/ai/chat': {
    request: AiChatRequest;
    response: AiChatResponse;
  };
  'POST /api/ai/analyze-document': {
    request: DocumentAnalysisRequest;
    response: AiDocumentAnalysisResponse;
  };
  'POST /api/ai/generate-draft': {
    request: DraftGenerationRequest;
    response: AiDraftResponse;
  };
  'POST /api/ai/generate-evidence': {
    request: EvidenceGenerationRequest;
    response: AiEvidenceResponse;
  };
  'POST /api/ai/legal-research': {
    request: LegalResearchRequest;
    response: LegalResearchResponse;
  };
  'POST /api/ai/verify-citations': {
    request: { text: string };
    response: CitationVerificationResponse;
  };
  'GET /api/ai/models': {
    request: never;
    response: AiModelsResponse;
  };
  'GET /api/ai/activity': {
    request: never;
    response: AiActivityResponse;
  };
};

// Extract request/response types from endpoint map
export type ApiRequestType<T extends keyof ApiEndpointMap> = ApiEndpointMap[T]['request'];
export type ApiResponseType<T extends keyof ApiEndpointMap> = ApiEndpointMap[T]['response'];