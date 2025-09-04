import { Job, Queue, Worker } from 'bullmq';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { createSafeCopy, sanitizeJobData, sanitizeJobResult } from '../utils/redis-serializer';
import { modelManager } from './model-manager';
import { structuredLogger, LogCategory } from './structured-logger';
import { gitService, GitStatus as _GitStatus, GitCommitInfo as _GitCommitInfo } from './git-service';

// Job types for different agents
export enum JobType {
  // Main orchestrator jobs
  CASE_ANALYSIS = 'case_analysis',
  STRATEGY_PLANNING = 'strategy_planning',

  // Legal research jobs
  LEGISLATION_LOOKUP = 'legislation_lookup',
  CASE_LAW_SEARCH = 'case_law_search',
  PRECEDENT_ANALYSIS = 'precedent_analysis',

  // Document jobs
  DOCUMENT_GENERATION = 'document_generation',
  DOCUMENT_REVIEW = 'document_review',
  CONTRACT_ANALYSIS = 'contract_analysis',

  // Compliance jobs
  GDPR_CHECK = 'gdpr_check',
  SRA_COMPLIANCE = 'sra_compliance',
  DEADLINE_CALCULATION = 'deadline_calculation',

  // API integration jobs
  COMPANIES_HOUSE_LOOKUP = 'companies_house_lookup',
  LAND_REGISTRY_SEARCH = 'land_registry_search',
  COURT_FILING_CHECK = 'court_filing_check',

  // Data processing jobs
  OCR_EXTRACTION = 'ocr_extraction',
  ENTITY_EXTRACTION = 'entity_extraction',
  EMBEDDING_GENERATION = 'embedding_generation',
}

interface AgentJob {
  id: string;
  type: JobType;
  priority: number;
  data: any;
  parentJobId?: string;
  requiredAgents?: string[];
  metadata?: {
    userId?: string;
    caseId?: string;
    documentId?: string;
    deadline?: Date;
    workflowId?: string;
    trackInGit?: boolean;
  };
}

interface AgentResult {
  jobId: string;
  success: boolean;
  result?: any;
  error?: string;
  processingTime: number;
  agentUsed: string;
  subJobs?: string[];
  gitContext?: {
    commitHash?: string;
    branchUsed?: string;
    filesModified?: string[];
  };
}

export class AgentWorkflow extends EventEmitter {
  private redis: Redis;
  private queues: Map<string, Queue>;
  private workers: Map<string, Worker>;
  private jobDependencies: Map<string, Set<string>>;
  private gpuEnabled: boolean = false;

  constructor() {
    super();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.queues = new Map();
    this.workers = new Map();
    this.jobDependencies = new Map();
    this.initializeQueues();
    this.checkGPUAvailability();
  }

  private async checkGPUAvailability() {
    try {
      // Check for AMD GPU with ROCm
      const { execSync } = require('child_process');
      const rocmCheck = execSync('rocm-smi --showid 2>/dev/null || echo "not found"').toString();
      this.gpuEnabled = !rocmCheck.includes('not found');

      if (this.gpuEnabled) {
        await structuredLogger.info(
          'GPU acceleration enabled for main orchestrator',
          LogCategory.AI_SERVICE,
          {
            metadata: {
              gpuLayers: 35,
              numGPU: 1,
              operation: 'gpu_initialization'
            }
          },
          ['gpu', 'acceleration', 'enabled']
        );
        // Set environment variable for Ollama to use GPU
        process.env.OLLAMA_GPU_LAYERS = '35'; // Use GPU for model layers
        process.env.OLLAMA_NUM_GPU = '1';
      }
    } catch {
      await structuredLogger.warn(
        'GPU not available, using CPU for AI models',
        LogCategory.AI_SERVICE,
        {
          metadata: {
            fallbackMode: 'CPU',
            operation: 'gpu_check_failed'
          }
        },
        ['gpu', 'unavailable', 'cpu-fallback']
      );
    }
  }

  private initializeQueues() {
    // High-priority queue for main orchestrator (GPU-accelerated)
    this.createQueue('main-orchestrator', {
      priority: 1,
      concurrency: 1, // Single instance to maximize GPU usage
      model: 'dolphin-mixtral',
    });

    // Legal research agents (medium models)
    this.createQueue('legal-research', {
      priority: 2,
      concurrency: 2,
      model: 'dolphin-mistral',
    });

    // Document processing agents (fast models)
    this.createQueue('document-processor', {
      priority: 3,
      concurrency: 3,
      model: 'llama3.2:3b',
    });

    // Compliance checking agents
    this.createQueue('compliance-checker', {
      priority: 3,
      concurrency: 2,
      model: 'llama2-uncensored',
    });

    // API integration agents (lightweight)
    this.createQueue('api-integrator', {
      priority: 4,
      concurrency: 5,
      model: 'tinyllama',
    });

    // Data processing agents
    this.createQueue('data-processor', {
      priority: 5,
      concurrency: 4,
      model: 'phi3:mini',
    });
  }

  private createQueue(name: string, config: any) {
    const queue = new Queue(name, {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    const worker = new Worker(name, async (job: Job) => this.processJob(job, config), {
      connection: this.redis,
      concurrency: config.concurrency,
    });

    worker.on('completed', async (job: Job, result: any) => {
      await structuredLogger.logJobProcessing(
        job.id!,
        job.name,
        'completed',
        result.processingTime,
        undefined,
        {
          metadata: {
            queueName: name,
            agentUsed: result.agentUsed,
            subJobsCreated: result.subJobs?.length || 0,
            operation: 'job_completed'
          }
        }
      );
      this.emit('job:completed', { jobId: job.id, result });
      this.checkDependencies(job.id!);
    });

    worker.on('failed', async (job: Job | undefined, error: Error) => {
      await structuredLogger.logJobProcessing(
        job?.id || 'unknown',
        job?.name || 'unknown',
        'failed',
        undefined,
        error,
        {
          metadata: {
            queueName: name,
            operation: 'job_failed'
          }
        }
      );
      this.emit('job:failed', { jobId: job?.id, error: error.message });
    });

    this.queues.set(name, queue);
    this.workers.set(name, worker);
  }

  async submitJob(job: AgentJob): Promise<string> {
    const queueName = this.determineQueue(job.type);
    const queue = this.queues.get(queueName);

    if (!queue) {
      await structuredLogger.error(
        `No queue available for job type: ${job.type}`,
        LogCategory.QUEUE_MANAGEMENT,
        new Error(`Queue not found: ${queueName}`),
        {
          jobId: job.id,
          metadata: {
            jobType: job.type,
            requestedQueue: queueName,
            operation: 'job_submission_failed'
          }
        },
        ['job', 'queue', 'not-found']
      );
      throw new Error(`No queue available for job type: ${job.type}`);
    }

    // Get git context for workflow tracking if enabled
    let gitContext = null;
    if (job.metadata?.trackInGit) {
      try {
        gitContext = await gitService.getWorkflowContext(
          job.metadata.workflowId, 
          job.metadata.caseId
        );
        
        await structuredLogger.debug(
          'Git context retrieved for job',
          LogCategory.VERSION_CONTROL,
          {
            jobId: job.id,
            metadata: {
              currentBranch: gitContext.status.currentBranch,
              hasUnstaged: gitContext.unstaged.length > 0,
              recentCommits: gitContext.recentCommits.length,
              operation: 'job_git_context'
            }
          },
          ['job', 'git', 'context']
        );
        
        // Include git context in job data
        job.data.gitContext = {
          currentBranch: gitContext.status.currentBranch,
          recentCommits: gitContext.recentCommits.slice(0, 3), // Last 3 commits
          hasChanges: !gitContext.status.clean
        };
      } catch (error: any) {
        await structuredLogger.warn(
          'Failed to retrieve git context for job',
          LogCategory.VERSION_CONTROL,
          {
            jobId: job.id,
            metadata: {
              error: error.message,
              operation: 'job_git_context_failed'
            }
          },
          ['job', 'git', 'context-failed']
        );
      }
    }

    await structuredLogger.info(
      `Submitting job to queue: ${job.type}`,
      LogCategory.JOB_PROCESSING,
      {
        jobId: job.id,
        metadata: {
          jobType: job.type,
          queueName,
          priority: job.priority,
          hasParent: !!job.parentJobId,
          operation: 'job_submission'
        }
      },
      ['job', 'submit', queueName]
    );

    // Sanitize job data for Redis serialization
    const sanitizedJob = sanitizeJobData(createSafeCopy(job));

    const bullJob = await queue.add(job.type, sanitizedJob, {
      priority: job.priority,
      delay: job.metadata?.deadline
        ? new Date(job.metadata.deadline).getTime() - Date.now()
        : undefined,
    });

    // Track dependencies if this job has parent
    if (job.parentJobId) {
      if (!this.jobDependencies.has(job.parentJobId)) {
        this.jobDependencies.set(job.parentJobId, new Set());
      }
      this.jobDependencies.get(job.parentJobId)!.add(bullJob.id!);
      
      await structuredLogger.debug(
        `Job dependency tracked: ${bullJob.id!} -> parent ${job.parentJobId}`,
        LogCategory.JOB_PROCESSING,
        {
          jobId: bullJob.id!,
          metadata: {
            parentJobId: job.parentJobId,
            jobType: job.type,
            operation: 'dependency_tracking'
          }
        },
        ['job', 'dependency', 'tracking']
      );
    }

    await structuredLogger.info(
      `Job submitted successfully: ${bullJob.id!}`,
      LogCategory.JOB_PROCESSING,
      {
        jobId: bullJob.id!,
        metadata: {
          jobType: job.type,
          queueName,
          priority: job.priority,
          delay: job.metadata?.deadline
            ? new Date(job.metadata.deadline).getTime() - Date.now()
            : undefined,
          operation: 'job_submitted'
        }
      },
      ['job', 'submitted', queueName]
    );

    return bullJob.id!;
  }

  private determineQueue(jobType: JobType): string {
    const queueMapping: Record<JobType, string> = {
      // Main orchestrator jobs
      [JobType.CASE_ANALYSIS]: 'main-orchestrator',
      [JobType.STRATEGY_PLANNING]: 'main-orchestrator',

      // Legal research
      [JobType.LEGISLATION_LOOKUP]: 'legal-research',
      [JobType.CASE_LAW_SEARCH]: 'legal-research',
      [JobType.PRECEDENT_ANALYSIS]: 'legal-research',

      // Document processing
      [JobType.DOCUMENT_GENERATION]: 'document-processor',
      [JobType.DOCUMENT_REVIEW]: 'document-processor',
      [JobType.CONTRACT_ANALYSIS]: 'document-processor',

      // Compliance
      [JobType.GDPR_CHECK]: 'compliance-checker',
      [JobType.SRA_COMPLIANCE]: 'compliance-checker',
      [JobType.DEADLINE_CALCULATION]: 'compliance-checker',

      // API integration
      [JobType.COMPANIES_HOUSE_LOOKUP]: 'api-integrator',
      [JobType.LAND_REGISTRY_SEARCH]: 'api-integrator',
      [JobType.COURT_FILING_CHECK]: 'api-integrator',

      // Data processing
      [JobType.OCR_EXTRACTION]: 'data-processor',
      [JobType.ENTITY_EXTRACTION]: 'data-processor',
      [JobType.EMBEDDING_GENERATION]: 'data-processor',
    };

    return queueMapping[jobType] || 'data-processor';
  }

  private async processJob(job: Job, config: any): Promise<AgentResult> {
    const startTime = Date.now();
    const agentJob = sanitizeJobResult(job.data) as AgentJob;

    await structuredLogger.logJobProcessing(
      job.id!,
      agentJob.type,
      'started',
      undefined,
      undefined,
      {
        metadata: {
          model: config.model,
          queueName: job.queueName,
          priority: agentJob.priority,
          operation: 'job_processing_start'
        }
      }
    );

    try {
      let result: any;
      const subJobs: string[] = [];
      let gitContext: any = null;

      // Create workflow branch if this is a case analysis or strategy planning
      if ((agentJob.type === JobType.CASE_ANALYSIS || agentJob.type === JobType.STRATEGY_PLANNING) 
          && agentJob.metadata?.trackInGit && agentJob.metadata?.workflowId) {
        try {
          const branchName = `workflow/${agentJob.metadata.workflowId}`;
          const status = await gitService.getStatus();
          
          // Create branch if it doesn't exist and we're not already on it
          if (status.currentBranch !== branchName) {
            const branches = await gitService.getBranches();
            const branchExists = branches.some(b => b.name === branchName);
            
            if (!branchExists) {
              await gitService.createBranch(branchName);
              await structuredLogger.info(
                'Created workflow branch',
                LogCategory.VERSION_CONTROL,
                {
                  jobId: job.id!,
                  metadata: {
                    branchName,
                    workflowId: agentJob.metadata.workflowId,
                    operation: 'workflow_branch_created'
                  }
                },
                ['workflow', 'git', 'branch-created']
              );
            } else {
              await gitService.checkoutBranch(branchName);
            }
            
            gitContext = { branchUsed: branchName };
          }
        } catch (error: any) {
          await structuredLogger.warn(
            'Failed to create/switch workflow branch',
            LogCategory.VERSION_CONTROL,
            {
              jobId: job.id!,
              metadata: {
                error: error.message,
                workflowId: agentJob.metadata.workflowId,
                operation: 'workflow_branch_failed'
              }
            },
            ['workflow', 'git', 'branch-failed']
          );
        }
      }

      // Main orchestrator delegates work
      if (agentJob.type === JobType.CASE_ANALYSIS) {
        result = await this.processCaseAnalysis(agentJob, subJobs);
      } else if (agentJob.type === JobType.STRATEGY_PLANNING) {
        result = await this.processStrategyPlanning(agentJob, subJobs);
      } else {
        // Process specialized job
        result = await this.processSpecializedJob(agentJob, config.model);
      }

      // Commit workflow progress if tracking enabled and significant changes made
      if (agentJob.metadata?.trackInGit && gitContext && 
          (agentJob.type === JobType.CASE_ANALYSIS || agentJob.type === JobType.STRATEGY_PLANNING)) {
        try {
          const status = await gitService.getStatus();
          if (!status.clean || status.untracked.length > 0) {
            // Add relevant files
            const filesToAdd = [...status.unstaged, ...status.untracked]
              .filter(f => f.includes('workflow') || f.includes('case') || f.includes('.json'))
              .slice(0, 10); // Limit files to avoid too many
            
            if (filesToAdd.length > 0) {
              await gitService.addFiles(filesToAdd);
              const commitMessage = `${agentJob.type}: ${agentJob.id}\n\nProcessed by ${config.model}`;
              const commitHash = await gitService.commit(
                commitMessage,
                agentJob.metadata.workflowId,
                agentJob.metadata.caseId
              );
              
              if (commitHash) {
                gitContext.commitHash = commitHash;
                gitContext.filesModified = filesToAdd;
                
                await structuredLogger.info(
                  'Workflow progress committed to git',
                  LogCategory.VERSION_CONTROL,
                  {
                    jobId: job.id!,
                    metadata: {
                      commitHash,
                      filesModified: filesToAdd.length,
                      workflowId: agentJob.metadata.workflowId,
                      operation: 'workflow_committed'
                    }
                  },
                  ['workflow', 'git', 'committed']
                );
              }
            }
          }
        } catch (error: any) {
          await structuredLogger.warn(
            'Failed to commit workflow progress',
            LogCategory.VERSION_CONTROL,
            {
              jobId: job.id!,
              metadata: {
                error: error.message,
                workflowId: agentJob.metadata.workflowId,
                operation: 'workflow_commit_failed'
              }
            },
            ['workflow', 'git', 'commit-failed']
          );
        }
      }

      // Sanitize result before returning to Redis
      const sanitizedResult = sanitizeJobData({
        jobId: job.id!,
        success: true,
        result: createSafeCopy(result),
        processingTime: Date.now() - startTime,
        agentUsed: config.model,
        subJobs,
        gitContext: gitContext || undefined,
      });

      return sanitizedResult as AgentResult;
    } catch (error: any) {
      // Sanitize error result
      const sanitizedError = sanitizeJobData({
        jobId: job.id!,
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime,
        agentUsed: config.model,
      });

      return sanitizedError as AgentResult;
    }
  }

  private async processCaseAnalysis(job: AgentJob, subJobs: string[]): Promise<any> {
    const { caseData, gitContext } = job.data;

    // Include git context in analysis if available
    let contextualInfo = '';
    if (gitContext) {
      contextualInfo = `

    Version Control Context:
    - Current branch: ${gitContext.currentBranch}
    - Repository has changes: ${gitContext.hasChanges}
    - Recent commits: ${gitContext.recentCommits?.map((c: any) => `${c.hash}: ${c.message}`).join(', ')}
    
    Consider this context when analyzing the case and planning workflow steps.`;
    }

    // Main orchestrator analyzes the case using GPU-accelerated model
    const analysisPrompt = `
    Analyze this legal case and create a comprehensive strategy:
    ${JSON.stringify(caseData)}${contextualInfo}

    Identify:
    1. Key legal issues
    2. Required research areas
    3. Document requirements
    4. Compliance checks needed
    5. API lookups required
    6. Version control strategy for case documents
    `;

    const analysis = await modelManager.generateResponse(analysisPrompt, 'main');

    // Create sub-jobs based on analysis
    const researchJob = await this.submitJob({
      id: `${job.id}-research`,
      type: JobType.CASE_LAW_SEARCH,
      priority: 2,
      data: { query: analysis.response, caseId: job.metadata?.caseId },
      parentJobId: job.id,
      metadata: {
        ...job.metadata,
        trackInGit: false // Sub-jobs don't need individual git tracking
      }
    });
    subJobs.push(researchJob);

    const complianceJob = await this.submitJob({
      id: `${job.id}-compliance`,
      type: JobType.SRA_COMPLIANCE,
      priority: 3,
      data: { caseData, requirements: analysis.response },
      parentJobId: job.id,
      metadata: {
        ...job.metadata,
        trackInGit: false
      }
    });
    subJobs.push(complianceJob);

    if (caseData.companyInvolved) {
      const companiesHouseJob = await this.submitJob({
        id: `${job.id}-companies`,
        type: JobType.COMPANIES_HOUSE_LOOKUP,
        priority: 4,
        data: { companyName: caseData.companyName },
        parentJobId: job.id,
        metadata: {
          ...job.metadata,
          trackInGit: false
        }
      });
      subJobs.push(companiesHouseJob);
    }

    return {
      analysis: analysis.response,
      subJobsCreated: subJobs.length,
      estimatedCompletion: new Date(Date.now() + 300000).toISOString(), // 5 minutes as ISO string
      gitContextUsed: !!gitContext
    };
  }

  private async processStrategyPlanning(job: AgentJob, subJobs: string[]): Promise<any> {
    const { caseAnalysis, legalResearch, gitContext } = job.data;

    // Include git history context for strategy planning
    let versionContext = '';
    if (gitContext) {
      versionContext = `

    Version Control Context for Strategy Planning:
    - Branch: ${gitContext.currentBranch}
    - Previous work: ${gitContext.recentCommits?.map((c: any) => c.message).join(', ')}
    - Consider document versioning and collaboration aspects in the strategy.`;
    }

    // GPU-accelerated strategy formulation
    const strategyPrompt = `
    Based on the case analysis and legal research, formulate a comprehensive legal strategy:

    Analysis: ${caseAnalysis}
    Research: ${legalResearch}${versionContext}

    Create:
    1. Step-by-step action plan
    2. Required documents list
    3. Timeline with deadlines
    4. Risk assessment
    5. Success probability
    6. Document version control strategy
    7. Collaboration and review workflow
    `;

    const strategy = await modelManager.generateResponse(strategyPrompt, 'main');

    // Generate required documents with git tracking
    const docJob = await this.submitJob({
      id: `${job.id}-docs`,
      type: JobType.DOCUMENT_GENERATION,
      priority: 2,
      data: {
        templates: ['letter-before-action', 'witness-statement'],
        context: strategy.response,
      },
      parentJobId: job.id,
      metadata: {
        ...job.metadata,
        trackInGit: true, // Document generation should be tracked
      }
    });
    subJobs.push(docJob);

    // Calculate deadlines
    const deadlineJob = await this.submitJob({
      id: `${job.id}-deadlines`,
      type: JobType.DEADLINE_CALCULATION,
      priority: 3,
      data: {
        events: strategy.response,
        startDate: new Date().toISOString(), // Use ISO string for Date serialization
      },
      parentJobId: job.id,
      metadata: {
        ...job.metadata,
        trackInGit: false
      }
    });
    subJobs.push(deadlineJob);

    return {
      strategy: strategy.response,
      documentsOrdered: true,
      deadlinesCalculating: true,
      processedAt: new Date().toISOString(), // Add timestamp as ISO string
      versionControlEnabled: !!gitContext
    };
  }

  private async processSpecializedJob(job: AgentJob, model: string): Promise<any> {
    // Handle specialized agent tasks
    switch (job.type) {
      case JobType.LEGISLATION_LOOKUP:
        return this.lookupLegislation(job.data);

      case JobType.COMPANIES_HOUSE_LOOKUP:
        return this.lookupCompaniesHouse(job.data);

      case JobType.DOCUMENT_GENERATION:
        return this.generateDocument(job.data, model);

      case JobType.GDPR_CHECK:
        return this.checkGDPRCompliance(job.data, model);

      case JobType.OCR_EXTRACTION:
        return this.extractWithOCR(job.data);

      case JobType.EMBEDDING_GENERATION:
        return this.generateEmbeddings(job.data);

      default: {
        // Use appropriate model for general processing
        const response = await modelManager.generateResponse(
          JSON.stringify(job.data),
          model === 'dolphin-mixtral' ? 'main' : 'mini',
        );
        return response.response;
      }
    }
  }

  private async lookupLegislation(_data: any): Promise<any> {
    // TODO: Integrate with legislation.gov.uk API
    return {
      legislation: 'Personal Injury Act 1971',
      relevantSections: ['Section 2', 'Section 5'],
      summary: 'Mock legislation lookup - to be implemented with real API',
    };
  }

  private async lookupCompaniesHouse(data: any): Promise<any> {
    // TODO: Integrate with Companies House API
    return {
      companyNumber: '12345678',
      companyName: data.companyName,
      status: 'Active',
      registeredAddress: 'Mock address',
      directors: ['John Doe', 'Jane Smith'],
    };
  }

  private async generateDocument(data: any, _model: string): Promise<any> {
    const prompt = `
    Generate a legal document:
    Type: ${data.templates.join(', ')}
    Context: ${data.context}

    Use proper UK legal formatting and language.
    Include version control comments if this is part of a tracked workflow.
    `;

    const response = await modelManager.generateResponse(prompt, 'code');
    const documents = data.templates.map((t: string) => ({
      template: t,
      content: response.response,
      generated: new Date().toISOString(), // Use ISO string for serialization
    }));

    // If git context is available, this indicates document versioning is enabled
    if (data.gitContext) {
      for (const doc of documents) {
        doc.versionControlled = true;
        doc.branch = data.gitContext.currentBranch;
        doc.content = `<!-- Document generated on branch: ${data.gitContext.currentBranch} -->\n` + doc.content;
      }
    }

    return { documents };
  }

  private async checkGDPRCompliance(data: any, _model: string): Promise<any> {
    const prompt = `
    Check GDPR compliance for:
    ${JSON.stringify(data)}

    Identify any privacy concerns and required consents.
    `;

    const response = await modelManager.generateResponse(prompt, 'mini');
    return {
      compliant: true,
      concerns: [],
      recommendations: response.response,
    };
  }

  private async extractWithOCR(_data: any): Promise<any> {
    // TODO: Integrate with Tesseract.js
    return {
      text: 'Extracted text from document',
      confidence: 0.95,
    };
  }

  private async generateEmbeddings(data: any): Promise<any> {
    const embeddings = await modelManager.generateEmbedding(data.text);

    // Ensure embeddings are properly serializable
    return {
      embeddings: Array.from(embeddings), // Ensure it's a plain array
      dimensions: embeddings.length,
      generatedAt: new Date().toISOString(), // Use ISO string instead of Date object
    };
  }

  private checkDependencies(parentJobId: string) {
    const dependencies = this.jobDependencies.get(parentJobId);
    if (dependencies && dependencies.size === 0) {
      // All sub-jobs completed, can proceed with next phase
      this.emit('workflow:completed', { parentJobId });
      this.jobDependencies.delete(parentJobId);
    }
  }

  async getWorkflowStatus(): Promise<any> {
    const status: any = {
      queues: {},
      workers: {},
      gpuEnabled: this.gpuEnabled,
    };

    for (const [name, queue] of this.queues) {
      const counts = await queue.getJobCounts();
      status.queues[name] = counts;
    }

    for (const [name, worker] of this.workers) {
      status.workers[name] = {
        running: worker.isRunning(),
        // @ts-ignore
        concurrency: worker.opts.concurrency,
      };
    }

    // Add git repository status
    try {
      const gitStatus = await gitService.getStatus();
      const branches = await gitService.getBranches();
      const recentCommits = await gitService.getCommitHistory(3);
      
      status.git = {
        currentBranch: gitStatus.currentBranch,
        clean: gitStatus.clean,
        branches: branches.length,
        workflowBranches: branches.filter(b => b.name.includes('workflow/')).length,
        recentCommits: recentCommits.length,
        unstagedFiles: gitStatus.unstaged.length,
        untrackedFiles: gitStatus.untracked.length
      };
    } catch (error: any) {
      status.git = {
        available: false,
        error: error.message
      };
    }

    return status;
  }

  async shutdown() {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    await this.redis.quit();
  }
}

export const agentWorkflow = new AgentWorkflow();
