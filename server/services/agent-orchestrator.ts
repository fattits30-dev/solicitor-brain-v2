import { modelManager } from './model-manager';
import { gitService, GitCommitInfo } from './git-service';
import { structuredLogger, LogCategory } from './structured-logger';

interface AgentTask {
  id: string;
  type: 'legal_research' | 'document_analysis' | 'case_summary' | 'draft_generation' | 'qa' | 'general';
  complexity: 'high' | 'medium' | 'low';
  context?: string;
  prompt: string;
  userId?: string;
  caseId?: string;
  workflowId?: string;
  trackInGit?: boolean;
  documentPath?: string;
}

interface AgentResponse {
  taskId: string;
  result: string;
  model: string;
  processingTime: number;
  confidence?: number;
  gitContext?: {
    commitHash?: string;
    branchName?: string;
    filesModified?: string[];
    repositoryClean?: boolean;
  };
}

export class AgentOrchestrator {
  private taskQueue: AgentTask[] = [];
  private processing: boolean = false;

  async processTask(task: AgentTask): Promise<AgentResponse> {
    const startTime = Date.now();
    
    // Determine which model to use based on task type and complexity
    const modelType = this.selectAgentType(task);
    
    try {
      // Get git context if tracking is enabled
      let gitContextInfo = null;
      if (task.trackInGit) {
        try {
          const gitContext = await gitService.getWorkflowContext(task.workflowId, task.caseId);
          gitContextInfo = {
            currentBranch: gitContext.status.currentBranch,
            recentCommits: gitContext.recentCommits.slice(0, 2),
            hasChanges: !gitContext.status.clean,
            workflowBranches: gitContext.workflowBranches?.length || 0
          };
          
          await structuredLogger.debug(
            'Git context retrieved for agent task',
            LogCategory.VERSION_CONTROL,
            {
              metadata: {
                taskId: task.id,
                taskType: task.type,
                currentBranch: gitContextInfo.currentBranch,
                hasChanges: gitContextInfo.hasChanges,
                operation: 'agent_task_git_context'
              }
            },
            ['agent', 'task', 'git-context']
          );
        } catch (error: any) {
          await structuredLogger.warn(
            'Failed to retrieve git context for agent task',
            LogCategory.VERSION_CONTROL,
            {
              metadata: {
                taskId: task.id,
                error: error.message,
                operation: 'agent_task_git_context_failed'
              }
            },
            ['agent', 'task', 'git-context-failed']
          );
        }
      }
      
      // Enhance prompt with task-specific and git context
      const enhancedPrompt = this.enhancePrompt(task, gitContextInfo);
      
      // Generate response using appropriate model
      const response = await modelManager.generateResponse(
        enhancedPrompt,
        modelType as 'main' | 'mini' | 'code' | 'chat'
      );
      
      const processingTime = Date.now() - startTime;
      
      // Handle git operations for document generation tasks
      let resultGitContext = undefined;
      if (task.trackInGit && (task.type === 'draft_generation' || task.type === 'document_analysis')) {
        try {
          resultGitContext = await this.handleDocumentVersioning(task, response.response);
        } catch (error: any) {
          await structuredLogger.warn(
            'Failed to handle document versioning',
            LogCategory.VERSION_CONTROL,
            {
              metadata: {
                taskId: task.id,
                error: error.message,
                operation: 'document_versioning_failed'
              }
            },
            ['agent', 'document', 'versioning-failed']
          );
        }
      }
      
      return {
        taskId: task.id,
        result: response.response,
        model: modelManager.getModelInfo(modelType)?.name || 'unknown',
        processingTime,
        confidence: this.calculateConfidence(response.response, task.type),
        gitContext: resultGitContext
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

  private enhancePrompt(task: AgentTask, gitContext?: any): string {
    const systemContext = this.getSystemContext(task.type);
    const userContext = task.context || '';
    
    // Add git context to prompt if available
    let gitContextPrompt = '';
    if (gitContext) {
      gitContextPrompt = `

Version Control Context:
- Current branch: ${gitContext.currentBranch}
- Repository has changes: ${gitContext.hasChanges}
- Recent activity: ${gitContext.recentCommits?.map((c: GitCommitInfo) => `${c.hash}: ${c.message}`).join(', ') || 'None'}
- Workflow branches: ${gitContext.workflowBranches}

Consider this version control context when generating your response, especially for document drafting and case analysis.`;
    }
    
    return `${systemContext}

Context: ${userContext}${gitContextPrompt}

Task: ${task.prompt}

Please provide a detailed and accurate response following UK legal standards and best practices.`;
  }

  private getSystemContext(taskType: string): string {
    const contexts: Record<string, string> = {
      legal_research: `You are a UK legal research assistant specializing in personal injury, benefits, and human rights law. 
                       Always cite relevant legislation and case law. Focus on practical application. 
                       Consider document version control and collaboration when researching.`,
      
      document_analysis: `You are analyzing legal documents. Extract key information, identify parties, dates, claims, 
                          and legal issues. Highlight any potential concerns or missing information.
                          Note any version control or document history information that may be relevant.`,
      
      case_summary: `You are summarizing a legal case. Include: parties involved, key dates, legal issues, 
                     current status, next steps, and any urgent deadlines.
                     Consider the workflow history and document evolution in your summary.`,
      
      draft_generation: `You are drafting legal correspondence. Use formal UK legal language, proper structure, 
                         and ensure all necessary elements are included. Be clear and concise.
                         Include appropriate version information and consider document collaboration needs.`,
      
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
    gitStatus?: {
      available: boolean;
      currentBranch?: string;
      clean?: boolean;
      recentCommits?: number;
    };
  }> {
    const modelsAvailable = await modelManager.checkModelAvailability();
    const activeModels = modelManager.getActiveModels();
    
    // Check git system health
    let gitStatus = undefined;
    try {
      const status = await gitService.getStatus();
      const commits = await gitService.getCommitHistory(5);
      
      gitStatus = {
        available: true,
        currentBranch: status.currentBranch,
        clean: status.clean,
        recentCommits: commits.length
      };
    } catch {
      gitStatus = {
        available: false
      };
    }
    
    return {
      modelsAvailable,
      activeModels,
      queueLength: this.taskQueue.length,
      gitStatus
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

  /**
   * Handle document versioning for generated content
   */
  private async handleDocumentVersioning(task: AgentTask, _generatedContent: string): Promise<any> {
    try {
      const status = await gitService.getStatus();
      
      // Check if there are changes to commit
      if (!status.clean || status.untracked.length > 0) {
        const filesToAdd = [...status.unstaged, ...status.untracked]
          .filter(f => f.includes('.txt') || f.includes('.md') || f.includes('.json'))
          .slice(0, 5); // Limit to avoid too many files
        
        if (filesToAdd.length > 0) {
          await gitService.addFiles(filesToAdd);
          
          const commitMessage = `${task.type}: ${task.id}\n\nGenerated by: ${task.userId || 'system'}\nTask type: ${task.type}\nComplexity: ${task.complexity}`;
          
          const commitHash = await gitService.commit(
            commitMessage,
            task.workflowId,
            task.caseId
          );
          
          if (commitHash) {
            await structuredLogger.info(
              'Agent task result committed to git',
              LogCategory.VERSION_CONTROL,
              {
                metadata: {
                  taskId: task.id,
                  taskType: task.type,
                  commitHash,
                  filesCommitted: filesToAdd.length,
                  operation: 'agent_task_committed'
                }
              },
              ['agent', 'task', 'git-committed']
            );
            
            return {
              commitHash,
              branchName: status.currentBranch,
              filesModified: filesToAdd,
              repositoryClean: false
            };
          }
        }
      }
      
      return {
        branchName: status.currentBranch,
        repositoryClean: status.clean
      };
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to handle document versioning',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            taskId: task.id,
            taskType: task.type,
            operation: 'document_versioning_error'
          }
        },
        ['agent', 'versioning', 'error']
      );
      throw error;
    }
  }
  
  /**
   * Get git context for legal case collaboration
   */
  async getCollaborationContext(caseId: string, workflowId?: string): Promise<{
    currentBranch: string;
    recentActivity: GitCommitInfo[];
    collaborators: string[];
    documentHistory: {
      file: string;
      lastModified: string;
      lastAuthor: string;
    }[];
  }> {
    try {
      const gitContext = await gitService.getWorkflowContext(workflowId, caseId);
      
      // Extract collaborator information from commit history
      const collaborators = [...new Set(
        gitContext.recentCommits.map(c => c.author)
      )];
      
      // Create document history from commits and diffs
      const documentHistory = gitContext.recentCommits.slice(0, 5).map(commit => ({
        file: `Case_${caseId}_${commit.hash}.md`,
        lastModified: commit.date,
        lastAuthor: commit.author
      }));
      
      return {
        currentBranch: gitContext.status.currentBranch,
        recentActivity: gitContext.recentCommits.slice(0, 10),
        collaborators,
        documentHistory
      };
    } catch (error: any) {
      await structuredLogger.error(
        'Failed to get collaboration context',
        LogCategory.VERSION_CONTROL,
        error,
        {
          metadata: {
            caseId,
            workflowId,
            operation: 'collaboration_context_error'
          }
        },
        ['collaboration', 'git', 'error']
      );
      
      // Return minimal context on error
      return {
        currentBranch: 'unknown',
        recentActivity: [],
        collaborators: [],
        documentHistory: []
      };
    }
  }
}

export const agentOrchestrator = new AgentOrchestrator();