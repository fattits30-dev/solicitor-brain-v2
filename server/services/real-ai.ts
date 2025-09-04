import { Ollama } from 'ollama';
import { storage } from '../storage.js';
import { legalAPIs } from './legal-apis.js';

export class RealAIService {
  private ollama: Ollama;
  private model: string;
  private embedModel: string;

  constructor() {
    // Single model configuration from environment
    this.model = process.env.OLLAMA_MODEL || 'llama3.2';
    this.embedModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

    this.ollama = new Ollama({
      host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    });
  }

  async chat(message: string, context?: any): Promise<string> {
    try {
      console.log('=== AI CHAT DEBUG ===');
      console.log('Message:', message);
      console.log('Context received:', JSON.stringify(context, null, 2));

      const systemPrompt = this.getSystemPrompt(context?.mode);
      console.log('System prompt generated:', systemPrompt.substring(0, 100) + '...');

      const contextualMessage = await this.buildContextualMessage(message, context);
      console.log('Contextual message built:', contextualMessage.substring(0, 200) + '...');

      const response = await this.ollama.chat({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: contextualMessage,
          },
        ],
        stream: false,
        options: {
          num_gpu: 99, // Use all available GPU layers
          temperature: 0.7,
          top_p: 0.9,
        },
      });

      return response.message.content;
    } catch (error) {
      console.error('Ollama chat error:', error);
      throw new Error('AI service temporarily unavailable');
    }
  }

  async chatStream(message: string, context?: any): Promise<string> {
    try {
      const systemPrompt = this.getSystemPrompt(context?.mode);
      const contextualMessage = await this.buildContextualMessage(message, context);

      let fullResponse = '';
      const response = await this.ollama.chat({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: contextualMessage,
          },
        ],
        stream: true,
        options: {
          num_gpu: 99, // Use all available GPU layers
          temperature: 0.7,
          top_p: 0.9,
        },
      });

      for await (const part of response) {
        const chunk = part.message.content;
        fullResponse += chunk;
        if (context?.onChunk) {
          context.onChunk(chunk);
        }
      }

      return fullResponse;
    } catch (error) {
      console.error('Ollama streaming chat error:', error);
      throw new Error('AI streaming service temporarily unavailable');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ollama.embeddings({
        model: this.embedModel,
        prompt: text,
      });
      return response.embedding;
    } catch (error) {
      console.error('Ollama embedding error:', error);
      throw new Error('Embedding service temporarily unavailable');
    }
  }

  async searchRelevantDocuments(query: string, caseId?: string, limit: number = 5): Promise<any[]> {
    try {
      // Generate embedding for the query
      const _queryEmbedding = await this.generateEmbedding(query);

      // In a full RAG implementation, this would search the vector database
      // For now, we'll get documents from the case and return the most relevant ones
      let documents;
      if (caseId) {
        documents = await storage.getDocumentsByCase(caseId);
      } else {
        documents = await storage.getAllDocuments();
      }

      // Filter documents with OCR text and return metadata
      const relevantDocs = documents
        .filter((doc) => doc.extractedText && doc.extractedText.length > 100)
        .slice(0, limit)
        .map((doc, _idx) => ({
          id: doc.id,
          filename: doc.fileName,
          type: doc.mimeType,
          excerpt:
            doc.extractedText?.substring(0, 200) +
            (doc.extractedText && doc.extractedText.length > 200 ? '...' : ''),
          relevanceScore: 0.85, // Placeholder - would be calculated from vector similarity
        }));

      return relevantDocs;
    } catch (error) {
      console.error('Document search error:', error);
      return [];
    }
  }

  async analyzeDocument(content: string): Promise<any> {
    if (!content || typeof content !== 'string') {
      throw new Error('Document content is required for analysis');
    }

    const prompt = `Analyze this legal document and provide:
1. Document type and purpose
2. Key parties involved  
3. Main legal issues or terms
4. Important dates and deadlines
5. Potential risks or concerns

Document:
${content.substring(0, 4000)}`;

    const analysis = await this.chat(prompt, { mode: 'legal' });

    return {
      analysis,
      timestamp: new Date().toISOString(),
      model: this.model,
    };
  }

  async generateDraft(template: string, data: any): Promise<string> {
    const prompt = `Generate a professional legal document based on this template and data.
Use trauma-informed language and ensure clarity.

Template: ${template}
Data: ${JSON.stringify(data)}

Generate the complete document:`;

    return await this.chat(prompt, { mode: 'draft' });
  }

  async generateEvidence(
    caseId: string,
    evidenceType: string = 'analysis',
    userId: string = 'system',
  ): Promise<any> {
    try {
      console.log('=== AI EVIDENCE GENERATION DEBUG ===');
      console.log('Case ID:', caseId);
      console.log('Evidence Type:', evidenceType);

      // Get comprehensive case data
      const caseData = await storage.getCase(caseId);
      if (!caseData) {
        throw new Error('Case not found');
      }

      // For now, skip document/event fetching due to schema mismatch
      // and focus on case data analysis
      let documents = [];
      let events = [];

      console.log('Skipping document/event fetching due to schema mismatch');
      console.log('Proceeding with case data only');

      console.log('Retrieved case data:', {
        title: caseData.title,
        documentsCount: documents.length,
        eventsCount: events.length,
      });

      let prompt = '';
      let analysis = '';

      switch (evidenceType) {
        case 'timeline':
          prompt = `Generate a comprehensive timeline analysis for this legal case:

Case: ${caseData.title}
Reference: ${caseData.caseReference}
Status: ${caseData.status}
Description: ${caseData.description}

Events (${events.length} total):
${events.length > 0 ? events.map((e) => `- ${new Date(e.eventDate).toLocaleDateString()}: ${e.title} (${e.eventType})`).join('\n') : '- No events recorded yet'}

Documents (${documents.length} total):
${documents.length > 0 ? documents.map((d) => `- ${d.fileName} (${d.mimeType}) - ${new Date(d.createdAt).toLocaleDateString()}`).join('\n') : '- No documents uploaded yet'}

Create a detailed timeline showing the progression of this case, highlighting key moments, potential evidence gaps, and strategic considerations.`;
          break;

        case 'strengths':
          prompt = `Analyze the strengths and evidence quality for this legal case:

Case: ${caseData.title}
Priority: ${caseData.priority || 'Normal'}
Description: ${caseData.description}

Available Documents: ${documents.length}
${documents.length > 0 ? documents.map((d) => `- ${d.fileName}: ${d.extractedText ? 'OCR processed (' + d.extractedText.length + ' chars)' : 'Not processed'}`).join('\n') : '- No documents available'}

Key Events: ${events.length}
${
  events.length > 0
    ? events
        .slice(0, 5)
        .map((e) => `- ${e.title} (${e.eventType})`)
        .join('\n')
    : '- No events recorded'
}

Provide a detailed analysis of:
1. Strength of evidence
2. Potential weaknesses or gaps  
3. Key supporting documents
4. Recommended next steps
5. Risk assessment`;
          break;

        case 'summary':
          prompt = `Generate an executive summary of this legal case for senior review:

Case Details:
- Title: ${caseData.title}
- Reference: ${caseData.caseReference}
- Status: ${caseData.status}
- Priority: ${caseData.priority || 'Standard'}
- Category: General Legal Matter

Background: ${caseData.description}

Documentation Status:
- Documents on file: ${documents.length}
- Recent events: ${events.length}

Create a concise executive summary suitable for senior solicitor review, highlighting key issues, current status, and recommendations.`;
          break;

        default: // 'analysis'
          prompt = `Provide a comprehensive legal analysis of this case:

Case Information:
- Title: ${caseData.title}
- Reference: ${caseData.caseReference || 'Not assigned'}
- Current Status: ${caseData.status}
- Priority Level: ${caseData.priority || 'Standard'}
- Case Category: General Legal Matter

Case Background:
${caseData.description || 'No description provided'}

Documentation Review (${documents.length} documents):
${
  documents.length > 0
    ? documents
        .map((d) => {
          const preview = d.extractedText
            ? d.extractedText.substring(0, 200) + '...'
            : 'No OCR text available';
          return `- ${d.fileName} (${d.mimeType}): ${preview}`;
        })
        .join('\n')
    : '- No documents available for review'
}

Recent Case Activity (${events.length} events):
${
  events.length > 0
    ? events
        .slice(0, 5)
        .map((e) => `- ${new Date(e.eventDate).toLocaleDateString()}: ${e.title}`)
        .join('\n')
    : '- No recent activity recorded'
}

Please provide:
1. Legal merit assessment
2. Key evidence identification
3. Potential challenges or risks
4. Recommended strategy
5. Next steps and priorities

Use UK legal standards and trauma-informed language throughout.`;
      }

      console.log('Generated prompt length:', prompt.length);

      analysis = await this.chat(prompt, {
        mode: 'legal',
        caseId: caseId,
      });

      console.log('AI analysis generated, length:', analysis.length);

      // Create audit trail
      await storage.createAuditEntry({
        userId,
        action: 'ai_evidence_generated',
        resource: 'case',
        resourceId: caseId,
        metadata: {
          evidenceType,
          documentsAnalyzed: documents.length,
          eventsAnalyzed: events.length,
          analysisLength: analysis.length,
        },
      });

      const evidenceFile = {
        id: `evidence_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        caseId,
        type: evidenceType,
        title: `AI ${evidenceType.charAt(0).toUpperCase() + evidenceType.slice(1)} - ${caseData.title}`,
        content: analysis,
        generatedBy: 'AI Assistant',
        generatedAt: new Date().toISOString(),
        model: this.model,
        documentsAnalyzed: documents.length,
        eventsAnalyzed: events.length,
        confidence: 0.85,
        metadata: {
          caseReference: caseData.caseReference,
          caseStatus: caseData.status,
          evidenceType,
          userId,
        },
      };

      console.log('Evidence file generated:', {
        id: evidenceFile.id,
        type: evidenceFile.type,
        contentLength: evidenceFile.content.length,
      });
      console.log('=== END AI EVIDENCE GENERATION DEBUG ===');

      return evidenceFile;
    } catch (error) {
      console.error('Evidence generation error:', error);
      throw new Error('Failed to generate evidence analysis');
    }
  }

  async summarize(text: string): Promise<string> {
    if (!text || typeof text !== 'string') {
      throw new Error('Text content is required for summarization');
    }

    const prompt = `Provide a concise summary of the following text, highlighting key legal points:

${text.substring(0, 4000)}`;

    return await this.chat(prompt);
  }

  async listModels(): Promise<any[]> {
    try {
      const response = await this.ollama.list();
      return response.models || [];
    } catch (error) {
      console.error('Ollama list models error:', error);
      return [];
    }
  }

  private getSystemPrompt(mode?: string): string {
    const basePrompt = `You are a helpful legal assistant specializing in UK law. 
Provide accurate, professional advice while being empathetic to clients.
Be concise and clear in your responses.`;

    switch (mode) {
      case 'legal':
        return `${basePrompt}
Focus on providing detailed legal analysis, identifying relevant statutes, case law, and procedural requirements.
Always include confidence levels and suggest when professional legal advice should be sought.`;

      case 'draft':
        return `${basePrompt}
Focus on drafting professional legal documents, letters, and correspondence.
Use appropriate legal language while maintaining clarity.
Include standard legal disclaimers and ensure trauma-informed language.`;

      default:
        return basePrompt;
    }
  }

  // Enhanced AI analysis with real-time legal research
  async chatWithLegalResearch(
    message: string,
    context?: any,
  ): Promise<{
    response: string;
    legalSources: any[];
    verifiedCitations: any[];
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      // Determine case type for targeted legal research
      const caseType = this.inferCaseType(message, context);

      // Get enhanced legal data
      const legalEnhancement = await legalAPIs.enhanceAIAnalysisWithLegalData(message, caseType);

      // Verify any legal citations mentioned in the message
      const citations = this.extractLegalCitations(message);
      const verifiedCitations = await Promise.all(
        citations.map((citation) => legalAPIs.verifyLegalCitation(citation)),
      );

      // Build enhanced context with real-time legal data
      const enhancedContext = {
        ...context,
        legalResearch: legalEnhancement,
        verifiedCitations: verifiedCitations.filter((v) => v.valid),
        researchTimestamp: new Date().toISOString(),
      };

      // Get AI response with enhanced legal context
      const response = await this.chat(message, enhancedContext);

      const processingTime = Date.now() - startTime;

      return {
        response,
        legalSources: legalEnhancement.relevantLegislation,
        verifiedCitations,
        processingTime,
      };
    } catch (error) {
      console.error('Legal research enhanced chat error:', error);
      // Fallback to regular chat if legal research fails
      const response = await this.chat(message, context);
      return {
        response,
        legalSources: [],
        verifiedCitations: [],
        processingTime: Date.now() - startTime,
      };
    }
  }

  // Company research integration
  async researchCompany(companyIdentifier: string): Promise<any> {
    try {
      // Try as company number first, then search by name
      let companyInfo = await legalAPIs.getCompanyInfo(companyIdentifier);

      if (!companyInfo && isNaN(Number(companyIdentifier))) {
        // Search by name would require additional API calls
        console.log(`Company search by name not implemented: ${companyIdentifier}`);
      }

      return companyInfo;
    } catch (error) {
      console.error('Company research error:', error);
      return null;
    }
  }

  // Legal citation verification
  async verifyCitations(text: string): Promise<{
    originalText: string;
    verifiedCitations: any[];
    unverifiedCitations: string[];
    confidence: number;
  }> {
    try {
      const citations = this.extractLegalCitations(text);
      const verificationResults = await Promise.all(
        citations.map((citation) => legalAPIs.verifyLegalCitation(citation)),
      );

      const verified = verificationResults.filter((v) => v.valid);
      const unverified = citations.filter((_, index) => !verificationResults[index].valid);

      return {
        originalText: text,
        verifiedCitations: verified,
        unverifiedCitations: unverified,
        confidence: citations.length > 0 ? verified.length / citations.length : 1,
      };
    } catch (error) {
      console.error('Citation verification error:', error);
      return {
        originalText: text,
        verifiedCitations: [],
        unverifiedCitations: [],
        confidence: 0,
      };
    }
  }

  private inferCaseType(message: string, context?: any): string {
    const text = (message + ' ' + (context?.description || '')).toLowerCase();

    if (text.includes('employ') || text.includes('discriminat') || text.includes('dismiss')) {
      return 'employment';
    }
    if (text.includes('data') || text.includes('gdpr') || text.includes('privacy')) {
      return 'data-protection';
    }
    if (text.includes('contract') || text.includes('breach') || text.includes('agreement')) {
      return 'contract';
    }
    if (text.includes('company') || text.includes('director') || text.includes('corporate')) {
      return 'corporate';
    }

    return 'general';
  }

  private extractLegalCitations(text: string): string[] {
    const citations: string[] = [];

    // Match various UK legal citation formats
    const patterns = [
      /([A-Z][a-z\s]+Act\s+\d{4})/g, // Employment Rights Act 1996
      /([A-Z][a-z\s]+Act\s+\d{4},?\s*s\.?\s*\d+)/g, // Equality Act 2010 s.39
      /(\[(\d{4})\]\s*[A-Z]+\s*\d+)/g, // [2024] EWCA Civ 123
      /(SI\s+\d{4}\/\d+)/g, // SI 2024/123
    ];

    patterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        citations.push(...matches);
      }
    });

    return [...new Set(citations)]; // Remove duplicates
  }

  private async buildContextualMessage(message: string, context?: any): Promise<string> {
    console.log('=== BUILD CONTEXTUAL MESSAGE DEBUG ===');
    console.log('Input message:', message);
    console.log('Input context:', JSON.stringify(context, null, 2));

    let contextualMessage = message;

    if (context?.caseId) {
      try {
        console.log('Loading case context for case ID:', context.caseId);
        const caseData = await storage.getCase(context.caseId);
        console.log('Retrieved case data:', JSON.stringify(caseData, null, 2));
        if (caseData) {
          contextualMessage = `[Case: ${caseData.title} - Status: ${caseData.status}] ${contextualMessage}`;

          // Add case context
          contextualMessage += `\n\nCase Context:`;
          contextualMessage += `\n- Reference: ${caseData.caseReference || 'Not specified'}`;
          contextualMessage += `\n- Priority: ${caseData.priority || 'Not specified'}`;
          contextualMessage += `\n- Description: ${caseData.description || 'No description available'}`;

          // Get recent events for this case
          const events = await storage.getEventsByCase(context.caseId);
          if (events.length > 0) {
            contextualMessage += `\n\nRecent Events:`;
            events.slice(0, 3).forEach((event, _idx) => {
              contextualMessage += `\n- ${new Date(event.eventDate).toLocaleDateString()}: ${event.title}`;
            });
          }

          // Get case documents
          const documents = await storage.getDocumentsByCase(context.caseId);
          if (documents.length > 0) {
            contextualMessage += `\n\nCase Documents (${documents.length} total):`;
            documents.slice(0, 3).forEach((doc) => {
              contextualMessage += `\n- ${doc.fileName} (${doc.mimeType})`;
            });
          }

          // RAG: Search for relevant documents based on the message
          const relevantDocs = await this.searchRelevantDocuments(message, context.caseId, 2);
          if (relevantDocs.length > 0) {
            contextualMessage += `\n\nRelevant Document Excerpts:`;
            relevantDocs.forEach((doc, _idx) => {
              contextualMessage += `\n- From ${doc.filename}: "${doc.excerpt}"`;
            });
          }
        }
      } catch (error) {
        console.error('Failed to load case context:', error);
        contextualMessage = `[Case ID: ${context.caseId} - Context loading failed] ${contextualMessage}`;
      }
    }

    if (context?.documentId) {
      try {
        const document = await storage.getDocument(context.documentId);
        if (document) {
          contextualMessage = `[Document: ${document.fileName}] ${contextualMessage}`;
          if (document.extractedText) {
            contextualMessage += `\n\nDocument Extract:\n${document.extractedText.substring(0, 1000)}${document.extractedText.length > 1000 ? '...' : ''}`;
          }
        }
      } catch (error) {
        console.error('Failed to load document context:', error);
        contextualMessage = `[Document Context Available] ${contextualMessage}`;
      }
    }

    if (context?.citations) {
      contextualMessage += `\n\nRelevant citations:\n${context.citations
        .map((c: any) => `- ${c.source} (page ${c.page}): ${c.text}`)
        .join('\n')}`;
    }

    console.log('Final contextual message length:', contextualMessage.length);
    console.log('Final contextual message preview:', contextualMessage.substring(0, 300) + '...');
    console.log('=== END BUILD CONTEXTUAL MESSAGE DEBUG ===');

    return contextualMessage;
  }
}

// Export singleton instance
export const aiService = new RealAIService();
