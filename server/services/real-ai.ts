import { Ollama } from 'ollama';
import type { ChatResponse, EmbeddingResponse } from 'ollama';

export class RealAIService {
  private ollama: Ollama;
  private embedModel = 'nomic-embed-text:latest';
  private chatModel = 'llama3.2:latest';
  
  constructor() {
    this.ollama = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://localhost:11434'
    });
  }

  async chat(message: string, context?: any): Promise<string> {
    try {
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful legal assistant specializing in UK law. Provide accurate, professional advice while being empathetic to clients.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        stream: false
      });
      
      return response.message.content;
    } catch (error) {
      console.error('Ollama chat error:', error);
      throw new Error('AI service temporarily unavailable');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ollama.embeddings({
        model: this.embedModel,
        prompt: text
      });
      
      return response.embedding;
    } catch (error) {
      console.error('Ollama embedding error:', error);
      throw new Error('Embedding generation failed');
    }
  }

  async analyzeDocument(content: string): Promise<any> {
    try {
      const prompt = `Analyze this legal document and extract:
1. Key parties involved
2. Important dates
3. Main legal issues
4. Risk assessment (high/medium/low)
5. Recommended actions

Document:
${content.substring(0, 3000)}`;

      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      });
      
      return {
        analysis: response.message.content,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Document analysis error:', error);
      throw new Error('Document analysis failed');
    }
  }

  async generateDraft(template: string, data: any): Promise<string> {
    try {
      const prompt = `Generate a professional legal document based on this template and data:

Template: ${template}
Data: ${JSON.stringify(data)}

Create a complete, properly formatted document.`;

      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      });
      
      return response.message.content;
    } catch (error) {
      console.error('Draft generation error:', error);
      throw new Error('Draft generation failed');
    }
  }

  async summarize(text: string): Promise<string> {
    try {
      const response = await this.ollama.chat({
        model: this.chatModel,
        messages: [
          {
            role: 'user',
            content: `Summarize this legal text in 3-5 bullet points:\n\n${text.substring(0, 2000)}`
          }
        ],
        stream: false
      });
      
      return response.message.content;
    } catch (error) {
      console.error('Summarization error:', error);
      throw new Error('Summarization failed');
    }
  }
}

export const aiService = new RealAIService();