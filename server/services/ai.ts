import { Ollama } from 'ollama';
import { storage } from '../storage.js';
import { db } from '../db.js';
import { embeddings } from '@shared/schema';
import { sql } from 'drizzle-orm';

interface DocumentChunk {
  text: string;
  metadata: {
    documentId: string;
    chunkIndex: number;
    startOffset: number;
    endOffset: number;
  };
}

interface QueryResult {
  text: string;
  score: number;
  documentId: string;
  metadata: any;
}

class AIService {
  private ollama: Ollama;
  private embeddingModel = 'nomic-embed-text';
  private chatModel = 'llama3.2';
  private chunkSize = 1000;
  private chunkOverlap = 200;

  constructor() {
    this.ollama = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://localhost:11434'
    });
  }

  async initialize() {
    try {
      // Check if models are available
      const models = await this.ollama.list();
      const modelNames = models.models.map(m => m.name);
      
      if (!modelNames.some(name => name.includes(this.embeddingModel))) {
        console.log(`Pulling embedding model ${this.embeddingModel}...`);
        await this.ollama.pull({ model: this.embeddingModel });
      }
      
      if (!modelNames.some(name => name.includes(this.chatModel))) {
        console.log(`Pulling chat model ${this.chatModel}...`);
        await this.ollama.pull({ model: this.chatModel });
      }
      
      console.log('AI Service initialized with Ollama');
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      console.log('AI features will be limited. Please ensure Ollama is running.');
    }
  }

  // Split text into chunks for embedding
  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          // Add overlap
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 5));
          currentChunk = overlapWords.join(' ') + ' ' + sentence;
        } else {
          // Single sentence is too long, split it
          chunks.push(sentence.substring(0, this.chunkSize));
          currentChunk = sentence.substring(this.chunkSize - this.chunkOverlap);
        }
      } else {
        currentChunk += ' ' + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Generate embeddings for text
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ollama.embeddings({
        model: this.embeddingModel,
        prompt: text
      });
      return response.embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Return a zero vector as fallback
      return new Array(384).fill(0);
    }
  }

  // Process and store document embeddings
  async processDocumentEmbeddings(documentId: string, text: string): Promise<void> {
    try {
      const chunks = this.chunkText(text);
      console.log(`Processing ${chunks.length} chunks for document ${documentId}`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.generateEmbedding(chunk);
        
        // Store embedding in database
        await db.insert(embeddings).values({
          documentId,
          chunkIx: i,
          vector: embedding as any, // pgvector will handle the conversion
          meta: {
            text: chunk.substring(0, 500), // Store first 500 chars for reference
            length: chunk.length,
            position: i,
            total: chunks.length
          }
        });
        
        console.log(`Processed chunk ${i + 1}/${chunks.length} for document ${documentId}`);
      }
    } catch (error) {
      console.error(`Failed to process embeddings for document ${documentId}:`, error);
      throw error;
    }
  }

  // Semantic search using vector similarity
  async semanticSearch(query: string, caseId?: string, limit = 10): Promise<QueryResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Build the SQL query for vector similarity search
      let searchQuery = sql`
        SELECT 
          e.document_id,
          e.chunk_ix,
          e.meta,
          e.vector <=> ${JSON.stringify(queryEmbedding)}::vector as distance,
          d.path,
          d.type,
          d.case_id
        FROM embeddings e
        JOIN documents d ON e.document_id = d.id
      `;
      
      if (caseId) {
        searchQuery = sql`${searchQuery} WHERE d.case_id = ${caseId}`;
      }
      
      searchQuery = sql`${searchQuery}
        ORDER BY distance
        LIMIT ${limit}
      `;
      
      const results = await db.execute(searchQuery);
      
      return results.rows.map((row: any) => ({
        text: row.meta?.text || '',
        score: 1 - row.distance, // Convert distance to similarity score
        documentId: row.document_id,
        metadata: {
          chunkIndex: row.chunk_ix,
          documentPath: row.path,
          documentType: row.type,
          caseId: row.case_id
        }
      }));
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }

  // Generate legal document draft
  async generateDraft(prompt: string, context?: string): Promise<string> {
    try {
      const systemPrompt = `You are a UK legal assistant specializing in trauma-informed legal practice. 
      You help draft legal documents that are clear, compassionate, and legally sound. 
      Always consider the emotional impact on vulnerable clients while maintaining professional standards.`;
      
      const fullPrompt = context 
        ? `Context:\n${context}\n\nRequest: ${prompt}`
        : prompt;
      
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullPrompt }
        ],
        options: {
          temperature: 0.7,
          top_p: 0.9,
        }
      });
      
      return response.message.content;
    } catch (error) {
      console.error('Failed to generate draft:', error);
      throw new Error('AI draft generation failed');
    }
  }

  // Analyze document for key information
  async analyzeDocument(text: string, analysisType: 'summary' | 'entities' | 'risks' | 'timeline'): Promise<any> {
    try {
      const prompts = {
        summary: 'Provide a concise summary of this legal document, highlighting key points and implications.',
        entities: 'Extract all persons, organizations, dates, locations, and legal references mentioned in this document. Format as JSON.',
        risks: 'Identify potential legal risks, compliance issues, and areas requiring immediate attention in this document.',
        timeline: 'Create a chronological timeline of events mentioned in this document. Include dates and key events.'
      };
      
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          { 
            role: 'system', 
            content: 'You are a UK legal expert analyzing documents for a law firm. Be precise and thorough.' 
          },
          { 
            role: 'user', 
            content: `${prompts[analysisType]}\n\nDocument:\n${text.substring(0, 8000)}` 
          }
        ],
        options: {
          temperature: 0.3,
          top_p: 0.95,
        }
      });
      
      // Try to parse as JSON for entities
      if (analysisType === 'entities') {
        try {
          return JSON.parse(response.message.content);
        } catch {
          return { raw: response.message.content };
        }
      }
      
      return response.message.content;
    } catch (error) {
      console.error(`Document analysis failed (${analysisType}):`, error);
      throw new Error(`Failed to analyze document: ${error}`);
    }
  }

  // Answer questions about a case
  async answerQuestion(question: string, caseId: string): Promise<string> {
    try {
      // First, find relevant context using semantic search
      const relevantChunks = await this.semanticSearch(question, caseId, 5);
      
      const context = relevantChunks
        .map(chunk => chunk.text)
        .join('\n\n---\n\n');
      
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          { 
            role: 'system', 
            content: `You are a UK legal assistant. Answer questions based on the provided case documents. 
            If the information is not in the context, say so. Be accurate and cite relevant parts of the documents.` 
          },
          { 
            role: 'user', 
            content: `Context from case documents:\n${context}\n\nQuestion: ${question}` 
          }
        ],
        options: {
          temperature: 0.5,
          top_p: 0.95,
        }
      });
      
      return response.message.content;
    } catch (error) {
      console.error('Failed to answer question:', error);
      throw new Error('AI question answering failed');
    }
  }
}

// Create singleton instance
export const aiService = new AIService();

// Initialize on module load
aiService.initialize().catch(console.error);