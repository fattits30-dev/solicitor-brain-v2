import { Ollama } from 'ollama';
import type { ChatResponse, EmbeddingsResponse } from 'ollama';

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
      const systemPrompt = this.getSystemPrompt(context?.mode);
      const contextualMessage = this.buildContextualMessage(message, context);
      
      const response = await this.ollama.chat({
        model: context?.model === 'mistral' ? 'mistral:7b' : this.chatModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: contextualMessage
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

  async chatStream(message: string, context?: any): Promise<string> {
    try {
      const systemPrompt = this.getSystemPrompt(context?.mode);
      const contextualMessage = this.buildContextualMessage(message, context);
      
      let fullResponse = '';
      const response = await this.ollama.chat({
        model: context?.model === 'mistral' ? 'mistral:7b' : this.chatModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: contextualMessage
          }
        ],
        stream: true
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

  private getSystemPrompt(mode?: string): string {
    const basePrompt = 'You are a helpful legal assistant specializing in UK law. Provide accurate, professional advice while being empathetic to clients.';
    
    switch (mode) {
      case 'legal':
        return `${basePrompt} Focus on providing detailed legal analysis, identifying relevant statutes, case law, and procedural requirements. Always include confidence levels and suggest when professional legal advice should be sought.`;
      case 'draft':
        return `${basePrompt} Focus on drafting professional legal documents, letters, and correspondence. Use appropriate legal language while maintaining clarity. Include standard legal disclaimers and ensure trauma-informed language.`;
      default:
        return basePrompt;
    }
  }

  private buildContextualMessage(message: string, context?: any): string {
    let contextualMessage = message;
    
    if (context?.caseId) {
      contextualMessage = `[Case ID: ${context.caseId}] ${contextualMessage}`;
    }
    
    if (context?.documentId) {
      contextualMessage = `[Document Context Available] ${contextualMessage}`;
    }
    
    if (context?.attachedFiles && context.attachedFiles.length > 0) {
      const fileList = context.attachedFiles.map((f: any) => f.name).join(', ');
      contextualMessage = `[Attached Files: ${fileList}] ${contextualMessage}`;
    }
    
    if (context?.previousMessages && context.previousMessages.length > 0) {
      const recentContext = context.previousMessages
        .slice(-3)
        .map((msg: any) => `${msg.role}: ${msg.content.slice(0, 200)}`)
        .join('\n');
      contextualMessage = `[Recent conversation context:\n${recentContext}]\n\n${contextualMessage}`;
    }
    
    return contextualMessage;
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