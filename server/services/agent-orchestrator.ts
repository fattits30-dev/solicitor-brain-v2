import { modelManager } from './model-manager';

interface AgentTask {
  id: string;
  type: 'legal_research' | 'document_analysis' | 'case_summary' | 'draft_generation' | 'qa' | 'general';
  complexity: 'high' | 'medium' | 'low';
  context?: string;
  prompt: string;
  userId?: string;
  caseId?: string;
}

interface AgentResponse {
  taskId: string;
  result: string;
  model: string;
  processingTime: number;
  confidence?: number;
}

export class AgentOrchestrator {
  private taskQueue: AgentTask[] = [];
  private processing: boolean = false;

  async processTask(task: AgentTask): Promise<AgentResponse> {
    const startTime = Date.now();
    
    // Determine which model to use based on task type and complexity
    const modelType = this.selectAgentType(task);
    
    try {
      // Enhance prompt with task-specific context
      const enhancedPrompt = this.enhancePrompt(task);
      
      // Generate response using appropriate model
      const response = await modelManager.generateResponse(
        enhancedPrompt,
        modelType as 'main' | 'mini' | 'code' | 'chat'
      );
      
      const processingTime = Date.now() - startTime;
      
      return {
        taskId: task.id,
        result: response.response,
        model: modelManager.getModelInfo(modelType)?.name || 'unknown',
        processingTime,
        confidence: this.calculateConfidence(response.response, task.type)
      };
    } catch (error) {
      console.error('Agent processing error:', error);
      throw error;
    }
  }

  private selectAgentType(task: AgentTask): string {
    // Legal research and complex analysis requires main agent
    if (task.type === 'legal_research' || task.type === 'case_summary') {
      return task.complexity === 'high' ? 'main' : 'chat';
    }
    
    // Document analysis uses specialized models
    if (task.type === 'document_analysis') {
      return task.complexity === 'high' ? 'main' : 'chat';
    }
    
    // Draft generation uses code model for structured output
    if (task.type === 'draft_generation') {
      return 'code';
    }
    
    // Q&A uses chat model for conversational responses
    if (task.type === 'qa') {
      return task.complexity === 'low' ? 'mini' : 'chat';
    }
    
    // Default based on complexity
    return task.complexity === 'high' ? 'main' : 
           task.complexity === 'low' ? 'mini' : 'chat';
  }

  private enhancePrompt(task: AgentTask): string {
    const systemContext = this.getSystemContext(task.type);
    const userContext = task.context || '';
    
    return `${systemContext}

Context: ${userContext}

Task: ${task.prompt}

Please provide a detailed and accurate response following UK legal standards and best practices.`;
  }

  private getSystemContext(taskType: string): string {
    const contexts: Record<string, string> = {
      legal_research: `You are a UK legal research assistant specializing in personal injury, benefits, and human rights law. 
                       Always cite relevant legislation and case law. Focus on practical application.`,
      
      document_analysis: `You are analyzing legal documents. Extract key information, identify parties, dates, claims, 
                          and legal issues. Highlight any potential concerns or missing information.`,
      
      case_summary: `You are summarizing a legal case. Include: parties involved, key dates, legal issues, 
                     current status, next steps, and any urgent deadlines.`,
      
      draft_generation: `You are drafting legal correspondence. Use formal UK legal language, proper structure, 
                         and ensure all necessary elements are included. Be clear and concise.`,
      
      qa: `You are answering legal questions. Provide clear, accurate information while noting that 
           this is for informational purposes and not legal advice.`,
      
      general: `You are assisting with legal case management tasks. Be accurate, thorough, and professional.`
    };
    
    return contexts[taskType] || contexts.general;
  }

  private calculateConfidence(response: string, taskType: string): number {
    // Simple confidence calculation based on response characteristics
    let confidence = 0.7; // Base confidence
    
    // Check for citations or references
    if (response.includes('Section') || response.includes('Act') || response.includes('Regulation')) {
      confidence += 0.1;
    }
    
    // Check for structured response
    if (response.includes('\n-') || response.includes('\n•') || response.includes('\n1.')) {
      confidence += 0.05;
    }
    
    // Check response length (too short might indicate incomplete answer)
    if (response.length > 200) {
      confidence += 0.05;
    }
    
    // Task-specific adjustments
    if (taskType === 'legal_research' && response.includes('case law')) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  async processMultipleTasks(tasks: AgentTask[]): Promise<AgentResponse[]> {
    const results: AgentResponse[] = [];
    
    // Process tasks in parallel batches to optimize throughput
    const batchSize = 3; // Process 3 tasks at a time
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchPromises = batch.map(task => this.processTask(task));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error('Batch processing error:', error);
        // Continue with remaining tasks
      }
    }
    
    return results;
  }

  async checkSystemHealth(): Promise<{
    modelsAvailable: Map<string, boolean>;
    activeModels: string[];
    queueLength: number;
  }> {
    const modelsAvailable = await modelManager.checkModelAvailability();
    const activeModels = modelManager.getActiveModels();
    
    return {
      modelsAvailable,
      activeModels,
      queueLength: this.taskQueue.length
    };
  }

  async warmupModels(): Promise<void> {
    console.log('Warming up AI models...');
    
    // Pre-load frequently used models
    const modelsToWarmup = ['mini', 'chat', 'embedding'];
    
    for (const model of modelsToWarmup) {
      try {
        await modelManager.loadModel(model);
        console.log(`Warmed up ${model} model`);
      } catch (error) {
        console.error(`Failed to warm up ${model}:`, error);
      }
    }
  }
}

export const agentOrchestrator = new AgentOrchestrator();