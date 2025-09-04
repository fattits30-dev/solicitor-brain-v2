import { Ollama } from 'ollama';
import dotenv from 'dotenv';

dotenv.config();

interface ModelConfig {
  name: string;
  type: 'main' | 'mini' | 'specialized' | 'embedding';
  priority: number;
  maxTokens?: number;
  temperature?: number;
}

export class ModelManager {
  private ollama: Ollama;
  private models: Map<string, ModelConfig>;
  private activeModels: Set<string>;

  constructor() {
    this.ollama = new Ollama({
      host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    });
    this.models = new Map();
    this.activeModels = new Set();
    this.initializeModels();
  }

  private initializeModels() {
    // Main agents - for complex reasoning
    this.models.set('main', {
      name: process.env.MAIN_AGENT_MODEL || 'dolphin-mixtral',
      type: 'main',
      priority: 1,
      maxTokens: 8192,
      temperature: 0.7,
    });

    // Mini agents - for quick responses
    this.models.set('mini', {
      name: process.env.MINI_AGENT_MODEL || 'llama3.2:3b',
      type: 'mini',
      priority: 2,
      maxTokens: 2048,
      temperature: 0.5,
    });

    // Code specialist
    this.models.set('code', {
      name: process.env.CODE_MODEL || 'llama2-uncensored',
      type: 'specialized',
      priority: 3,
      maxTokens: 4096,
      temperature: 0.3,
    });

    // Chat model
    this.models.set('chat', {
      name: process.env.CHAT_MODEL || 'dolphin-mistral',
      type: 'specialized',
      priority: 2,
      maxTokens: 4096,
      temperature: 0.7,
    });

    // Embedding model
    this.models.set('embedding', {
      name: process.env.EMBEDDING_MODEL_LARGE || 'nomic-embed-text',
      type: 'embedding',
      priority: 1,
    });

    // Fallback model
    this.models.set('fallback', {
      name: process.env.FALLBACK_MODEL || 'tinyllama',
      type: 'mini',
      priority: 10,
      maxTokens: 1024,
      temperature: 0.5,
    });
  }

  async selectModel(taskType: string, complexity: 'high' | 'medium' | 'low'): Promise<string> {
    // Model selection logic based on task type and complexity
    if (taskType === 'embedding') {
      return this.models.get('embedding')!.name;
    }

    if (taskType === 'code') {
      return this.models.get('code')!.name;
    }

    if (complexity === 'high') {
      return this.models.get('main')!.name;
    }

    if (complexity === 'low') {
      return this.models.get('mini')!.name;
    }

    // Default to chat model for medium complexity
    return this.models.get('chat')!.name;
  }

  async generateResponse(
    prompt: string,
    modelType: 'main' | 'mini' | 'code' | 'chat' = 'chat',
    stream: boolean = false,
  ) {
    const config = this.models.get(modelType) || this.models.get('fallback')!;

    try {
      const response = await this.ollama.generate({
        model: config.name,
        prompt,
        stream,
        options: {
          num_predict: config.maxTokens,
          temperature: config.temperature,
        },
      });

      return response;
    } catch (error) {
      console.error(`Error with model ${config.name}, falling back...`, error);

      // Fallback to simpler model
      const fallbackModel = this.models.get('fallback')!;
      return this.ollama.generate({
        model: fallbackModel.name,
        prompt,
        stream,
        options: {
          num_predict: fallbackModel.maxTokens,
          temperature: fallbackModel.temperature,
        },
      });
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const model = this.models.get('embedding')!.name;

    try {
      const response = await this.ollama.embeddings({
        model,
        prompt: text,
      });

      return response.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async checkModelAvailability(): Promise<Map<string, boolean>> {
    const availability = new Map<string, boolean>();

    try {
      const availableModels = await this.ollama.list();
      const modelNames = availableModels.models.map((m) => m.name);

      for (const [key, config] of this.models) {
        const isAvailable = modelNames.some((name) => name.startsWith(config.name.split(':')[0]));
        availability.set(key, isAvailable);
      }
    } catch {
      console.error('Error checking model availability');
    }

    return availability;
  }

  async loadModel(modelType: string): Promise<void> {
    const config = this.models.get(modelType);
    if (!config) {
      throw new Error(`Unknown model type: ${modelType}`);
    }

    try {
      // Pre-load model by making a simple request
      await this.ollama.generate({
        model: config.name,
        prompt: 'Hello',
        options: { num_predict: 1 },
      });

      this.activeModels.add(modelType);
      console.log(`Model ${config.name} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load model ${config.name}:`, error);
      throw error;
    }
  }

  async unloadModel(modelType: string): Promise<void> {
    this.activeModels.delete(modelType);
    // Ollama handles model unloading automatically based on memory pressure
  }

  getActiveModels(): string[] {
    return Array.from(this.activeModels);
  }

  getModelInfo(modelType: string): ModelConfig | undefined {
    return this.models.get(modelType);
  }
}

export const modelManager = new ModelManager();
