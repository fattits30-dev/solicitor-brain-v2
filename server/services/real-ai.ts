import { Ollama } from 'ollama';

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
      const systemPrompt = this.getSystemPrompt(context?.mode);
      const contextualMessage = this.buildContextualMessage(message, context);

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
      const contextualMessage = this.buildContextualMessage(message, context);

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

  async analyzeDocument(content: string): Promise<any> {
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

  async summarize(text: string): Promise<string> {
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

  private buildContextualMessage(message: string, context?: any): string {
    let contextualMessage = message;

    if (context?.caseId) {
      contextualMessage = `[Case ID: ${context.caseId}] ${contextualMessage}`;
    }

    if (context?.documentId) {
      contextualMessage = `[Document Context Available] ${contextualMessage}`;
    }

    if (context?.citations) {
      contextualMessage += `\n\nRelevant citations:\n${context.citations.map((c: any) => 
        `- ${c.source} (page ${c.page}): ${c.text}`
      ).join('\n')}`;
    }

    return contextualMessage;
  }
}

// Export singleton instance
export const aiService = new RealAIService();