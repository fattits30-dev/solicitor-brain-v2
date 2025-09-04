import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { aiService } from '../services/real-ai.ts';
import { 
  AiChatResponse,
  AiDocumentAnalysisResponse,
  AiDraftResponse,
  AiEvidenceResponse,
  AiSummarizationResponse,
  AiModelsResponse,
  LegalResearchResponse,
  CitationVerificationResponse,
  AiActivityResponse,
  aiChatRequestSchema,
  documentAnalysisRequestSchema,
  draftGenerationRequestSchema,
  evidenceGenerationRequestSchema,
  legalResearchRequestSchema
} from '../../shared/api-types.ts';

const router = Router();

// Enhanced AI Chat endpoint with streaming support
router.post('/chat', authenticate, async (req, res) => {
  try {
    // Validate request body
    const validationResult = aiChatRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    const { message, context, stream = false } = validationResult.data;
    const startTime = Date.now();

    if (stream) {
      // Set headers for streaming
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      });

      const _response = await aiService.chatStream(message, {
        ...context,
        onChunk: (chunk: string) => {
          res.write(chunk);
        },
      });

      res.end();
    } else {
      const response = await aiService.chat(message, context);
      const processingTime = Date.now() - startTime;

      const chatResponse: AiChatResponse = {
        response,
        content: response,
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        confidence: 0.85,
        processingTime,
        timestamp: new Date().toISOString(),
      };

      res.json(chatResponse);
    }
  } catch (error: any) {
    console.error('AI chat error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'AI service unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// Analyze document with real AI
router.post('/analyze-document', authenticate, async (req, res) => {
  try {
    // Validate request body
    const validationResult = documentAnalysisRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    const { content, options: _options } = validationResult.data;
    const startTime = Date.now();
    
    // This would call the actual AI service
    const analysis = await aiService.analyzeDocument(content);
    const processingTime = Date.now() - startTime;

    // Create typed response
    const analysisResponse: AiDocumentAnalysisResponse = {
      summary: analysis.summary || '',
      keyPoints: analysis.keyPoints || [],
      entities: analysis.entities || [],
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.8,
      processingTime,
      extractedText: analysis.extractedText,
      metadata: analysis.metadata,
      timestamp: new Date().toISOString(),
    };

    res.json(analysisResponse);
  } catch (error: any) {
    console.error('Document analysis error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Analysis failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Generate draft with real AI
router.post('/generate-draft', authenticate, async (req, res) => {
  try {
    // Validate request body
    const validationResult = draftGenerationRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    const { template, data, options } = validationResult.data;
    const startTime = Date.now();
    
    const draft = await aiService.generateDraft(template, data, options);
    const processingTime = Date.now() - startTime;

    const draftResponse: AiDraftResponse = {
      content: draft,
      template,
      confidence: 0.85,
      processingTime,
      metadata: {
        wordCount: draft.split(/\s+/).length,
        estimated_reading_time: Math.ceil(draft.split(/\s+/).length / 200), // 200 words per minute
        tone: options?.tone || 'formal',
        template_used: template,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(draftResponse);
  } catch (error: any) {
    console.error('Draft generation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Draft generation failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Summarize text with real AI
router.post('/summarize', authenticate, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'Text content is required for summarization',
        timestamp: new Date().toISOString(),
      });
    }

    const startTime = Date.now();
    const summary = await aiService.summarize(text);
    const processingTime = Date.now() - startTime;

    const summarizationResponse: AiSummarizationResponse = {
      summary,
      keyPoints: [], // This would be extracted from the AI service
      confidence: 0.85,
      processingTime,
      originalLength: text.length,
      summaryLength: summary.length,
      compressionRatio: Math.round((1 - summary.length / text.length) * 100) / 100,
      timestamp: new Date().toISOString(),
    };

    res.json(summarizationResponse);
  } catch (error: any) {
    console.error('Summarization error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Summarization failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Generate AI evidence analysis for a case
router.post('/generate-evidence', authenticate, async (req, res) => {
  try {
    // Validate request body
    const validationResult = evidenceGenerationRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    const { caseId, evidenceType } = validationResult.data;
    const startTime = Date.now();

    const evidence = await aiService.generateEvidence(
      caseId,
      evidenceType,
      req.user?.id || 'system',
    );
    const processingTime = Date.now() - startTime;

    const evidenceResponse: AiEvidenceResponse = {
      evidence: {
        type: evidenceType,
        content: evidence.content || '',
        supporting_documents: evidence.supporting_documents || [],
        legal_precedents: evidence.legal_precedents || [],
        strength_assessment: evidence.strength_assessment || 'moderate',
        recommendations: evidence.recommendations || [],
      },
      confidence: evidence.confidence || 0.8,
      processingTime,
      timestamp: new Date().toISOString(),
    };

    res.json(evidenceResponse);
  } catch (error: any) {
    console.error('Evidence generation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Evidence generation failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// List available AI models
router.get('/models', authenticate, async (req, res) => {
  try {
    const models = await aiService.listModels();
    
    const modelsResponse: AiModelsResponse = {
      models: models.map(model => ({
        name: model.name || '',
        version: model.version || '1.0',
        description: model.description || '',
        capabilities: model.capabilities || ['chat'],
        parameters: {
          max_tokens: model.parameters?.max_tokens || 4096,
          context_length: model.parameters?.context_length || 4096,
        },
        status: model.status || 'available',
      })),
      timestamp: new Date().toISOString(),
    };

    res.json(modelsResponse);
  } catch (error: any) {
    console.error('List models error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to list models',
      timestamp: new Date().toISOString(),
    });
  }
});

// Enhanced AI chat with real-time legal research
router.post('/chat-enhanced', authenticate, async (req, res) => {
  try {
    // Validate request body (reuse the chat schema with legal mode)
    const validationResult = aiChatRequestSchema.safeParse({
      ...req.body,
      context: { ...req.body.context, mode: 'legal' }
    });
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    const { message, context, stream = false } = validationResult.data;
    const startTime = Date.now();

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      });

      // Note: Streaming with legal research would require more complex implementation
      const result = await aiService.chatWithLegalResearch(message, context);
      res.write(JSON.stringify(result));
      res.end();
    } else {
      const result = await aiService.chatWithLegalResearch(message, context);
      const processingTime = Date.now() - startTime;

      const enhancedChatResponse: AiChatResponse = {
        response: result.response,
        content: result.response,
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        confidence: 0.9, // Higher confidence with verified sources
        processingTime,
        legalSources: result.legalSources || [],
        verifiedCitations: result.verifiedCitations || [],
        researchEnabled: true,
        timestamp: new Date().toISOString(),
      };

      res.json(enhancedChatResponse);
    }
  } catch (error: any) {
    console.error('Enhanced AI chat error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Enhanced AI service unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// Company research endpoint
router.post('/research-company', authenticate, async (req, res) => {
  try {
    const { companyIdentifier } = req.body;

    if (!companyIdentifier) {
      return res.status(400).json({ 
        success: false,
        error: 'Company identifier is required',
        timestamp: new Date().toISOString(),
      });
    }

    const companyInfo = await aiService.researchCompany(companyIdentifier);

    if (!companyInfo) {
      return res.status(404).json({ 
        success: false,
        error: 'Company not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Return typed response - the company info is already in the correct format from the service
    res.json({
      company: companyInfo,
      timestamp: new Date().toISOString(),
      source: 'Companies House API',
    });
  } catch (error: any) {
    console.error('Company research error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Company research failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Legal citation verification endpoint
router.post('/verify-citations', authenticate, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'Text content is required for citation verification',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await aiService.verifyCitations(text);

    const verificationResponse: CitationVerificationResponse = {
      verifiedCitations: result.verifiedCitations || [],
      totalCitations: result.totalCitations || 0,
      verifiedCount: result.verifiedCount || 0,
      verificationRate: result.verificationRate || 0,
      source: 'legislation.gov.uk',
      timestamp: new Date().toISOString(),
    };

    res.json(verificationResponse);
  } catch (error: any) {
    console.error('Citation verification error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Citation verification failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Legal research endpoint - search for relevant legislation
router.post('/legal-research', authenticate, async (req, res) => {
  try {
    // Validate request body
    const validationResult = legalResearchRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    const { query, caseType, includeCompanyInfo } = validationResult.data;

    // Import legal APIs service
    const { legalAPIs } = await import('../services/legal-apis.js');

    const promises = [legalAPIs.enhanceAIAnalysisWithLegalData(query, caseType)];

    // Add company research if requested and query looks like a company
    if (includeCompanyInfo) {
      const companyPattern = /\b\d{8}\b|Ltd|Limited|PLC|plc/i;
      if (companyPattern.test(query)) {
        promises.push(aiService.researchCompany(query));
      }
    }

    const results = await Promise.allSettled(promises);

    const legalResearch = results[0].status === 'fulfilled' ? results[0].value : null;
    const companyInfo =
      results.length > 1 && results[1].status === 'fulfilled' ? results[1].value : null;

    const researchResponse: LegalResearchResponse = {
      query,
      caseType,
      legalResearch: {
        relevantLegislation: legalResearch?.relevantLegislation || [],
        recentCases: legalResearch?.recentCases || [],
        additionalContext: legalResearch?.additionalContext || '',
      },
      companyInfo,
      sources: ['legislation.gov.uk', 'Companies House API'].filter(Boolean),
      timestamp: new Date().toISOString(),
    };

    res.json(researchResponse);
  } catch (error: any) {
    console.error('Legal research error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Legal research failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get recent AI activity
router.get('/activity', authenticate, async (req, res) => {
  try {
    // In production, this would fetch real AI activity from audit logs
    const activities = [
      {
        id: '1',
        description: 'OCR processing completed for document: contract_draft_v2.pdf',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        type: 'ocr' as const,
        model: process.env.OLLAMA_MODEL || 'llama3.2',
      },
      {
        id: '2',
        description: 'RAG search indexed 47 new document chunks',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        type: 'rag' as const,
        model: 'nomic-embed-text',
      },
      {
        id: '3',
        description: 'Draft generated: Response letter (empathetic tone)',
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        type: 'draft' as const,
        model: process.env.OLLAMA_MODEL || 'llama3.2',
      },
      {
        id: '4',
        description: 'Privacy audit completed - all data redacted appropriately',
        timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        type: 'privacy' as const,
        model: 'system',
      },
    ];

    const activityResponse: AiActivityResponse = {
      activities,
      total: activities.length,
      timestamp: new Date().toISOString(),
    };

    res.json(activityResponse);
  } catch (error: any) {
    console.error('AI activity error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch AI activity',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
