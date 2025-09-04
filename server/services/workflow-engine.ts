import { aiService } from './ai.js';
import { deadlineCalculatorService } from './deadline-calculator.js';
import { addDays } from 'date-fns';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category:
    | 'litigation'
    | 'conveyancing'
    | 'probate'
    | 'employment'
    | 'family'
    | 'commercial'
    | 'personal_injury';
  stages: WorkflowStage[];
  estimated_duration: string; // e.g., "3-6 months"
  complexity: 'low' | 'medium' | 'high';
  prerequisites: string[];
}

export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  order: number;
  estimated_duration_days: number;
  tasks: WorkflowTask[];
  milestones: WorkflowMilestone[];
  dependencies: string[]; // IDs of prerequisite stages
  parallel_allowed: boolean; // Can run in parallel with other stages
  approval_required: boolean;
  approver_role?: string;
}

export interface WorkflowTask {
  id: string;
  name: string;
  description: string;
  type:
    | 'document_draft'
    | 'form_completion'
    | 'research'
    | 'client_contact'
    | 'court_filing'
    | 'negotiation'
    | 'review'
    | 'other';
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_hours: number;
  assignee_role: string; // 'partner', 'associate', 'paralegal', 'secretary'
  dependencies: string[]; // Task IDs this task depends on
  deliverables: string[];
  due_offset_days: number; // Days from stage start
  automation_available: boolean;
  automation_service?: string; // Service that can automate this task
  template_id?: string;
  checklist: WorkflowChecklistItem[];
}

export interface WorkflowMilestone {
  id: string;
  name: string;
  description: string;
  criteria: string[];
  client_notification: boolean;
  court_deadline?: boolean;
  billing_trigger?: boolean;
}

export interface WorkflowChecklistItem {
  id: string;
  description: string;
  required: boolean;
  evidence_required?: string;
}

export interface CaseWorkflow {
  id: string;
  case_id: string;
  template_id: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  current_stage: string;
  stages: CaseWorkflowStage[];
  created_at: Date;
  updated_at: Date;
  estimated_completion: Date;
  actual_completion?: Date;
  metadata: {
    created_by: string;
    client_id: string;
    matter_type: string;
    complexity_override?: 'low' | 'medium' | 'high';
    custom_instructions?: string;
  };
}

export interface CaseWorkflowStage {
  stage_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
  started_at?: Date;
  completed_at?: Date;
  assigned_to?: string;
  tasks: CaseWorkflowTask[];
  milestones: CaseWorkflowMilestone[];
  notes: string[];
}

export interface CaseWorkflowTask {
  task_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue';
  assigned_to?: string;
  started_at?: Date;
  completed_at?: Date;
  due_date: Date;
  time_spent_hours?: number;
  deliverables_completed: string[];
  checklist_items: Array<{
    item_id: string;
    completed: boolean;
    evidence?: string;
    completed_at?: Date;
  }>;
  notes: string[];
  automation_attempted?: boolean;
  automation_result?: 'success' | 'partial' | 'failed';
}

export interface CaseWorkflowMilestone {
  milestone_id: string;
  status: 'pending' | 'achieved' | 'missed';
  achieved_at?: Date;
  criteria_met: Array<{
    criterion: string;
    met: boolean;
    evidence?: string;
  }>;
}

class WorkflowEngineService {
  // Standard workflow templates
  private workflowTemplates: WorkflowTemplate[] = [
    {
      id: 'debt-recovery-litigation',
      name: 'Debt Recovery Litigation',
      description: 'Standard workflow for recovering commercial debts through court action',
      category: 'litigation',
      estimated_duration: '4-8 months',
      complexity: 'medium',
      prerequisites: ['client_retainer', 'debt_documentation'],
      stages: [
        {
          id: 'initial_assessment',
          name: 'Initial Assessment',
          description: 'Assess case merits and collectability',
          order: 1,
          estimated_duration_days: 7,
          dependencies: [],
          parallel_allowed: false,
          approval_required: false,
          tasks: [
            {
              id: 'debt_validation',
              name: 'Validate Debt Documentation',
              description: 'Review contracts, invoices, and proof of debt',
              type: 'review',
              priority: 'critical',
              estimated_hours: 2,
              assignee_role: 'associate',
              dependencies: [],
              deliverables: ['Debt validation report'],
              due_offset_days: 2,
              automation_available: true,
              automation_service: 'document-analysis',
              checklist: [
                {
                  id: 'contracts_reviewed',
                  description: 'Original contracts reviewed',
                  required: true,
                },
                {
                  id: 'invoices_validated',
                  description: 'Invoices and statements validated',
                  required: true,
                },
                { id: 'payments_tracked', description: 'Payment history analyzed', required: true },
              ],
            },
            {
              id: 'debtor_asset_search',
              name: 'Debtor Asset Investigation',
              description: "Investigate debtor's financial position and assets",
              type: 'research',
              priority: 'high',
              estimated_hours: 3,
              assignee_role: 'paralegal',
              dependencies: ['debt_validation'],
              deliverables: ['Asset search report'],
              due_offset_days: 5,
              automation_available: false,
              checklist: [
                {
                  id: 'company_search',
                  description: 'Companies House search completed',
                  required: true,
                },
                {
                  id: 'land_registry',
                  description: 'Land Registry search if applicable',
                  required: false,
                },
                { id: 'credit_check', description: 'Credit report obtained', required: true },
              ],
            },
            {
              id: 'collectability_assessment',
              name: 'Collectability Assessment',
              description: 'Assess likelihood of successful recovery',
              type: 'review',
              priority: 'high',
              estimated_hours: 1,
              assignee_role: 'associate',
              dependencies: ['debt_validation', 'debtor_asset_search'],
              deliverables: ['Collectability report', 'Strategy recommendation'],
              due_offset_days: 7,
              automation_available: true,
              automation_service: 'ai-risk-assessment',
              checklist: [
                {
                  id: 'recovery_prospects',
                  description: 'Recovery prospects assessed',
                  required: true,
                },
                {
                  id: 'cost_benefit',
                  description: 'Cost-benefit analysis completed',
                  required: true,
                },
              ],
            },
          ],
          milestones: [
            {
              id: 'assessment_complete',
              name: 'Initial Assessment Complete',
              description: 'Case merits and collectability assessed',
              criteria: ['debt_validated', 'assets_investigated', 'collectability_assessed'],
              client_notification: true,
              billing_trigger: false,
            },
          ],
        },
        {
          id: 'pre_action_phase',
          name: 'Pre-Action Phase',
          description: 'Pre-action protocol compliance and demand letters',
          order: 2,
          estimated_duration_days: 21,
          dependencies: ['initial_assessment'],
          parallel_allowed: false,
          approval_required: false,
          tasks: [
            {
              id: 'letter_before_action',
              name: 'Send Letter Before Action',
              description: 'Draft and send formal letter before action',
              type: 'document_draft',
              priority: 'critical',
              estimated_hours: 2,
              assignee_role: 'associate',
              dependencies: [],
              deliverables: ['Letter before action', 'Proof of service'],
              due_offset_days: 3,
              automation_available: true,
              automation_service: 'document-automation',
              template_id: 'letter-before-action',
              checklist: [
                {
                  id: 'letter_drafted',
                  description: 'Letter drafted with all required elements',
                  required: true,
                },
                {
                  id: 'letter_sent',
                  description: 'Letter sent by recorded delivery',
                  required: true,
                },
                {
                  id: 'response_deadline',
                  description: 'Response deadline clearly stated',
                  required: true,
                },
              ],
            },
            {
              id: 'response_monitoring',
              name: 'Monitor Response',
              description: 'Monitor for debtor response within deadline',
              type: 'other',
              priority: 'medium',
              estimated_hours: 1,
              assignee_role: 'paralegal',
              dependencies: ['letter_before_action'],
              deliverables: ['Response summary'],
              due_offset_days: 14,
              automation_available: true,
              automation_service: 'deadline-tracking',
              checklist: [
                {
                  id: 'response_received',
                  description: 'Any response received recorded',
                  required: true,
                },
                {
                  id: 'response_analyzed',
                  description: 'Response content analyzed',
                  required: false,
                },
              ],
            },
            {
              id: 'settlement_negotiation',
              name: 'Settlement Negotiation',
              description: 'Attempt settlement negotiation if appropriate',
              type: 'negotiation',
              priority: 'medium',
              estimated_hours: 4,
              assignee_role: 'associate',
              dependencies: ['response_monitoring'],
              deliverables: ['Negotiation record', 'Settlement terms (if agreed)'],
              due_offset_days: 21,
              automation_available: false,
              checklist: [
                {
                  id: 'settlement_attempted',
                  description: 'Settlement discussions attempted',
                  required: true,
                },
                {
                  id: 'terms_documented',
                  description: 'Any agreed terms documented',
                  required: false,
                },
              ],
            },
          ],
          milestones: [
            {
              id: 'pre_action_complete',
              name: 'Pre-Action Protocol Complied With',
              description: 'All pre-action protocol requirements satisfied',
              criteria: ['letter_sent', 'response_period_expired', 'settlement_attempted'],
              client_notification: true,
              court_deadline: false,
              billing_trigger: true,
            },
          ],
        },
        {
          id: 'court_proceedings',
          name: 'Court Proceedings',
          description: 'Issue and serve court proceedings',
          order: 3,
          estimated_duration_days: 28,
          dependencies: ['pre_action_phase'],
          parallel_allowed: false,
          approval_required: true,
          approver_role: 'partner',
          tasks: [
            {
              id: 'claim_form_preparation',
              name: 'Prepare Claim Form',
              description: 'Draft N1 claim form and particulars of claim',
              type: 'form_completion',
              priority: 'critical',
              estimated_hours: 3,
              assignee_role: 'associate',
              dependencies: [],
              deliverables: ['N1 Claim Form', 'Particulars of Claim'],
              due_offset_days: 5,
              automation_available: true,
              automation_service: 'form-automation',
              template_id: 'n1-claim-form',
              checklist: [
                {
                  id: 'claim_form_complete',
                  description: 'Claim form completed accurately',
                  required: true,
                },
                {
                  id: 'particulars_attached',
                  description: 'Particulars of claim attached',
                  required: true,
                },
                {
                  id: 'court_fee_calculated',
                  description: 'Correct court fee calculated',
                  required: true,
                },
              ],
            },
            {
              id: 'court_issue',
              name: 'Issue Proceedings',
              description: 'Submit claim form to court and pay fees',
              type: 'court_filing',
              priority: 'critical',
              estimated_hours: 1,
              assignee_role: 'paralegal',
              dependencies: ['claim_form_preparation'],
              deliverables: ['Sealed claim form', 'Case number'],
              due_offset_days: 7,
              automation_available: false,
              checklist: [
                { id: 'form_filed', description: 'Claim form filed with court', required: true },
                { id: 'fees_paid', description: 'Court fees paid', required: true },
                {
                  id: 'case_number_received',
                  description: 'Case number allocated',
                  required: true,
                },
              ],
            },
            {
              id: 'service_of_proceedings',
              name: 'Service of Proceedings',
              description: 'Serve sealed claim form on defendant',
              type: 'other',
              priority: 'critical',
              estimated_hours: 2,
              assignee_role: 'paralegal',
              dependencies: ['court_issue'],
              deliverables: ['Certificate of service'],
              due_offset_days: 14,
              automation_available: false,
              checklist: [
                {
                  id: 'service_method_chosen',
                  description: 'Appropriate service method chosen',
                  required: true,
                },
                {
                  id: 'service_effected',
                  description: 'Service effected properly',
                  required: true,
                },
                {
                  id: 'certificate_filed',
                  description: 'Certificate of service filed',
                  required: true,
                },
              ],
            },
          ],
          milestones: [
            {
              id: 'proceedings_served',
              name: 'Proceedings Issued and Served',
              description: 'Court proceedings properly issued and served',
              criteria: ['claim_issued', 'service_completed', 'deadlines_diarized'],
              client_notification: true,
              court_deadline: true,
              billing_trigger: true,
            },
          ],
        },
      ],
    },
    {
      id: 'residential-conveyancing',
      name: 'Residential Property Purchase',
      description: 'Standard workflow for residential property purchase',
      category: 'conveyancing',
      estimated_duration: '8-12 weeks',
      complexity: 'medium',
      prerequisites: ['mortgage_offer', 'survey_completed'],
      stages: [
        {
          id: 'initial_instructions',
          name: 'Initial Instructions and Searches',
          description: 'Take initial instructions and order property searches',
          order: 1,
          estimated_duration_days: 14,
          dependencies: [],
          parallel_allowed: true,
          approval_required: false,
          tasks: [
            {
              id: 'client_care_letter',
              name: 'Send Client Care Letter',
              description: 'Send client care letter and terms of business',
              type: 'client_contact',
              priority: 'critical',
              estimated_hours: 1,
              assignee_role: 'secretary',
              dependencies: [],
              deliverables: ['Client care letter', 'Terms of business'],
              due_offset_days: 1,
              automation_available: true,
              automation_service: 'client-communications',
              checklist: [
                { id: 'care_letter_sent', description: 'Client care letter sent', required: true },
                { id: 'id_verified', description: 'Client identity verified', required: true },
              ],
            },
            {
              id: 'property_searches',
              name: 'Order Property Searches',
              description: 'Order local authority and other relevant searches',
              type: 'other',
              priority: 'high',
              estimated_hours: 1,
              assignee_role: 'paralegal',
              dependencies: [],
              deliverables: ['Search applications', 'Search results'],
              due_offset_days: 2,
              automation_available: false,
              checklist: [
                {
                  id: 'local_search',
                  description: 'Local authority search ordered',
                  required: true,
                },
                {
                  id: 'water_search',
                  description: 'Water authority search ordered',
                  required: true,
                },
                {
                  id: 'environmental_search',
                  description: 'Environmental search ordered',
                  required: false,
                },
              ],
            },
          ],
          milestones: [
            {
              id: 'searches_ordered',
              name: 'All Searches Ordered',
              description: 'All necessary property searches have been ordered',
              criteria: ['client_care_sent', 'searches_ordered'],
              client_notification: true,
              billing_trigger: false,
            },
          ],
        },
      ],
    },
  ];

  /**
   * Get all workflow templates
   */
  getWorkflowTemplates(): WorkflowTemplate[] {
    return [...this.workflowTemplates];
  }

  /**
   * Get workflow template by ID
   */
  getWorkflowTemplate(templateId: string): WorkflowTemplate | null {
    return this.workflowTemplates.find((t) => t.id === templateId) || null;
  }

  /**
   * Create case workflow from template
   */
  async createCaseWorkflow(
    caseId: string,
    templateId: string,
    _clientId: string,
    _matterType: string,
    createdBy: string,
    customizations?: {
      complexity_override?: 'low' | 'medium' | 'high';
      custom_instructions?: string;
      skip_stages?: string[];
      priority_override?: { [taskId: string]: 'critical' | 'high' | 'medium' | 'low' };
    },
  ): Promise<CaseWorkflow> {
    const template = this.getWorkflowTemplate(templateId);
    if (!template) {
      throw new Error(`Workflow template ${templateId} not found`);
    }

    const now = new Date();

    // Calculate estimated completion date
    const totalDays = template.stages.reduce(
      (sum, stage) => sum + stage.estimated_duration_days,
      0,
    );
    const estimatedCompletion = addDays(now, totalDays);

    // Create case workflow stages
    const stages: CaseWorkflowStage[] = [];

    for (const stageTemplate of template.stages) {
      if (customizations?.skip_stages?.includes(stageTemplate.id)) {
        continue; // Skip this stage if requested
      }

      const tasks: CaseWorkflowTask[] = [];

      for (const taskTemplate of stageTemplate.tasks) {
        const dueDate = addDays(now, taskTemplate.due_offset_days);

        tasks.push({
          task_id: taskTemplate.id,
          status: 'pending',
          due_date: dueDate,
          deliverables_completed: [],
          checklist_items: taskTemplate.checklist.map((item) => ({
            item_id: item.id,
            completed: false,
          })),
          notes: [],
          git_commits: [],
          documents_versioned: [],
        });
      }

      const milestones: CaseWorkflowMilestone[] = stageTemplate.milestones.map((m) => ({
        milestone_id: m.id,
        status: 'pending',
        criteria_met: m.criteria.map((criterion) => ({
          criterion,
          met: false,
        })),
      }));

      stages.push({
        stage_id: stageTemplate.id,
        status: stageTemplate.order === 1 ? 'pending' : 'pending',
        tasks,
        milestones,
        notes: [],
        git_commits: [],
        documents_committed: [],
      });
    }

    const caseWorkflow: CaseWorkflow = {
      id: `wf_${Date.now()}`,
      case_id: caseId,
      template_id: templateId,
      status: 'not_started',
      current_stage: template.stages[0]?.id || '',
      stages,
      created_at: now,
      updated_at: now,
      estimated_completion: estimatedCompletion,
      metadata: {
        created_by: createdBy,
        client_id: _clientId,
        matter_type: _matterType,
        complexity_override: customizations?.complexity_override,
        custom_instructions: customizations?.custom_instructions,
      },
    };

    // Auto-start workflow if no approval required
    if (!template.stages[0]?.approval_required) {
      await this.startWorkflow(caseWorkflow.id);
    }

    return caseWorkflow;
  }

  /**
   * Start workflow execution
   */
  async startWorkflow(_workflowId: string): Promise<void> {
    // In production, would fetch from database
    // For now, simulate workflow start
    console.log(`Starting workflow ${_workflowId}`);

    // Start first stage
    // Auto-assign tasks based on workload
    // Set up deadline monitoring
    // Send notifications
  }

  /**
   * Get next tasks for a workflow
   */
  getNextTasks(workflow: CaseWorkflow, _assigneeRole?: string): CaseWorkflowTask[] {
    const currentStage = workflow.stages.find((s) => s.stage_id === workflow.current_stage);
    if (!currentStage) return [];

    const nextTasks = currentStage.tasks.filter((task) => {
      // Task must be pending or in progress
      if (task.status === 'completed' || task.status === 'skipped') return false;

      // Check if task dependencies are satisfied
      const template = this.getWorkflowTemplate(workflow.template_id);
      const stageTemplate = template?.stages.find((s) => s.id === currentStage.stage_id);
      const taskTemplate = stageTemplate?.tasks.find((t) => t.id === task.task_id);

      if (taskTemplate?.dependencies && taskTemplate.dependencies.length > 0) {
        const dependenciesMet = taskTemplate.dependencies.every((depId) => {
          const depTask = currentStage.tasks.find((t) => t.task_id === depId);
          return depTask?.status === 'completed';
        });

        if (!dependenciesMet) return false;
      }

      // Filter by assignee role if specified
      if (_assigneeRole && taskTemplate?.assignee_role !== _assigneeRole) {
        return false;
      }

      return true;
    });

    return nextTasks.sort((a, b) => a.due_date.getTime() - b.due_date.getTime());
  }

  /**
   * Complete task
   */
  async completeTask(
    workflowId: string,
    _stageId: string,
    _taskId: string,
    _completedBy: string,
    _deliverables: string[],
    _timeSpentHours: number,
    _notes?: string,
  ): Promise<{
    task_completed: boolean;
    stage_completed: boolean;
    workflow_advanced: boolean;
    next_tasks: CaseWorkflowTask[];
    git_commit?: string;
  }> {
    // In production, would fetch workflow from database
    console.log(`Completing task ${_taskId} in workflow ${workflowId}`);
    
    let gitCommit: string | undefined;
    
    // If git tracking is enabled, commit task completion
    try {
      // This would fetch the actual workflow to check git_tracking
      // For now, we'll attempt to commit if we can
      const commitMessage = `Complete task: ${_taskId}\n\nDeliverables: ${_deliverables.join(', ')}\nCompleted by: ${_completedBy}\nTime spent: ${_timeSpentHours}h`;
      
      gitCommit = await gitService.commit(commitMessage, workflowId);
      
      if (gitCommit) {
        await structuredLogger.info(
          'Task completion committed to git',
          LogCategory.VERSION_CONTROL,
          {
            metadata: {
              workflowId,
              taskId: _taskId,
              commitHash: gitCommit,
              deliverables: _deliverables.length,
              operation: 'task_completion_committed'
            }
          },
          ['workflow', 'task', 'git-committed']
        );
      }
    } catch (error: any) {
      await structuredLogger.warn(
        'Failed to commit task completion to git',
        LogCategory.VERSION_CONTROL,
        {
          metadata: {
            workflowId,
            taskId: _taskId,
            error: error.message,
            operation: 'task_completion_commit_failed'
          }
        },
        ['workflow', 'task', 'git-commit-failed']
      );
    }

    // Mark task as completed
    // Update deliverables
    // Record time spent
    // Check if stage is now complete
    // Advance to next stage if appropriate
    // Trigger automations if available

    // For demo, return success
    return {
      task_completed: true,
      stage_completed: false,
      workflow_advanced: false,
      next_tasks: [],
      git_commit: gitCommit,
    };
  }

  /**
   * Auto-assign tasks based on workload and skill
   */
  async autoAssignTasks(
    _workflowId: string,
    availableStaff: Array<{
      id: string;
      name: string;
      role: string;
      current_workload: number; // Hours per week
      max_capacity: number;
      skills: string[];
      hourly_rate: number;
    }>,
  ): Promise<
    Array<{
      task_id: string;
      assigned_to: string;
      reason: string;
    }>
  > {
    try {
      // Use AI to optimize task assignments
      const assignmentPrompt = `Optimize task assignments for workflow ${_workflowId}:
        
        Available staff: ${JSON.stringify(availableStaff)}
        
        Consider:
        1. Current workload vs capacity
        2. Role requirements for each task
        3. Skill matching
        4. Cost optimization
        5. Deadline priorities
        
        Return optimal assignments with reasoning.`;

      const _assignments = await aiService.generateDraft(
        assignmentPrompt,
        'You are optimizing legal workflow task assignments. Consider workload, skills, and costs.',
      );

      // Parse AI response and return assignments
      // For demo, return simple assignment
      return [
        {
          task_id: 'debt_validation',
          assigned_to: availableStaff[0]?.id || 'auto',
          reason: 'Best role match and available capacity',
        },
      ];
    } catch (error) {
      console.error('Auto-assignment failed:', error);
      return [];
    }
  }

  /**
   * Generate workflow progress report
   */
  async generateProgressReport(_workflowId: string): Promise<{
    summary: string;
    completion_percentage: number;
    stages_summary: Array<{
      stage_name: string;
      status: string;
      tasks_completed: number;
      tasks_total: number;
      on_schedule: boolean;
    }>;
    overdue_tasks: Array<{
      task_name: string;
      due_date: Date;
      assigned_to: string;
      days_overdue: number;
    }>;
    upcoming_deadlines: Array<{
      task_name: string;
      due_date: Date;
      days_remaining: number;
    }>;
    cost_analysis: {
      budgeted_hours: number;
      actual_hours: number;
      estimated_cost: number;
      actual_cost: number;
    };
    recommendations: string[];
  }> {
    // In production, would fetch actual workflow data
    return {
      summary: 'Workflow is progressing on schedule with 3 of 5 stages completed',
      completion_percentage: 60,
      stages_summary: [
        {
          stage_name: 'Initial Assessment',
          status: 'completed',
          tasks_completed: 3,
          tasks_total: 3,
          on_schedule: true,
        },
      ],
      overdue_tasks: [],
      upcoming_deadlines: [],
      cost_analysis: {
        budgeted_hours: 40,
        actual_hours: 35,
        estimated_cost: 8000,
        actual_cost: 7000,
      },
      recommendations: [
        'Consider advancing to next stage early',
        'Review resource allocation for efficiency',
      ],
    };
  }

  /**
   * Trigger automation for eligible tasks
   */
  async triggerTaskAutomation(
    _workflowId: string,
    taskId: string,
    caseData: any,
    clientData: any,
  ): Promise<{
    automation_triggered: boolean;
    service_used?: string;
    result?: any;
    completion_status: 'success' | 'partial' | 'failed';
    manual_review_required: boolean;
    next_steps: string[];
  }> {
    try {
      // Find task template to determine automation service
      const _template = this.getWorkflowTemplate(_workflowId);
      // ... find specific task template

      // Example automation triggers
      if (taskId === 'letter_before_action') {
        // Trigger document automation
        const result = await this.triggerDocumentAutomation(taskId, caseData, clientData);
        return result;
      } else if (taskId === 'claim_form_preparation') {
        // Trigger form automation
        const result = await this.triggerFormAutomation(taskId, caseData, clientData);
        return result;
      } else if (taskId === 'deadline_monitoring') {
        // Trigger deadline calculation
        const result = await this.triggerDeadlineAutomation(taskId, caseData);
        return result;
      }

      return {
        automation_triggered: false,
        completion_status: 'failed',
        manual_review_required: true,
        next_steps: ['Complete task manually'],
      };
    } catch (error) {
      console.error('Task automation failed:', error);
      return {
        automation_triggered: false,
        completion_status: 'failed',
        manual_review_required: true,
        next_steps: ['Review automation error and complete manually'],
      };
    }
  }

  /**
   * Helper methods for specific automation triggers
   */
  private async triggerDocumentAutomation(
    _taskId: string,
    _caseData: any,
    _clientData: any,
  ): Promise<any> {
    // Would integrate with document automation service
    return {
      automation_triggered: true,
      service_used: 'document-automation',
      completion_status: 'success' as const,
      manual_review_required: false,
      next_steps: ['Review generated document', 'Send to client for approval'],
    };
  }

  private async triggerFormAutomation(
    _taskId: string,
    _caseData: any,
    _clientData: any,
  ): Promise<any> {
    // Would integrate with form automation service
    return {
      automation_triggered: true,
      service_used: 'form-automation',
      completion_status: 'partial' as const,
      manual_review_required: true,
      next_steps: ['Review auto-populated form', 'Complete missing fields', 'Submit to court'],
    };
  }

  private async triggerDeadlineAutomation(_taskId: string, caseData: any): Promise<any> {
    try {
      // Use deadline calculator service
      const deadlines = await deadlineCalculatorService.generateCaseDeadlines(
        caseData.id,
        'litigation',
        {
          causeOfAction: caseData.causeOfActionDate,
          serviceDate: caseData.serviceDate,
        },
      );

      return {
        automation_triggered: true,
        service_used: 'deadline-calculator',
        result: deadlines,
        completion_status: 'success' as const,
        manual_review_required: false,
        next_steps: ['Review calculated deadlines', 'Add to case diary'],
      };
    } catch {
      return {
        automation_triggered: false,
        completion_status: 'failed' as const,
        manual_review_required: true,
        next_steps: ['Calculate deadlines manually'],
      };
    }
  }

  /**
   * AI-powered workflow optimization suggestions
   */
  async generateWorkflowOptimizations(_workflowId: string): Promise<{
    efficiency_suggestions: string[];
    cost_savings: string[];
    risk_mitigations: string[];
    automation_opportunities: string[];
  }> {
    try {
      const _optimization = await aiService.generateDraft(
        `Analyze workflow ${_workflowId} and suggest optimizations for:
         1. Process efficiency improvements
         2. Cost reduction opportunities
         3. Risk mitigation strategies
         4. Additional automation possibilities
         
         Focus on practical, implementable suggestions.`,
        'You are a legal process improvement consultant analyzing workflow efficiency.',
      );

      return {
        efficiency_suggestions: [
          'Parallelize independent tasks to reduce timeline',
          'Implement template standardization for common documents',
        ],
        cost_savings: [
          'Automate routine document generation',
          'Use junior staff for appropriate tasks',
        ],
        risk_mitigations: [
          'Add compliance checkpoints at key stages',
          'Implement automated deadline monitoring',
        ],
        automation_opportunities: ['Court form auto-population', 'Client update notifications'],
      };
    } catch (error) {
      console.error('Workflow optimization failed:', error);
      return {
        efficiency_suggestions: ['Manual workflow review recommended'],
        cost_savings: ['Analyze task allocation and billing efficiency'],
        risk_mitigations: ['Review compliance checkpoints'],
        automation_opportunities: ['Identify repetitive manual tasks'],
      };
    }
  }

  /**
   * Get workflow statistics and metrics
   */
  getWorkflowMetrics(_templateId: string): {
    total_workflows: number;
    average_completion_time: number;
    success_rate: number;
    common_bottlenecks: Array<{ stage: string; average_delay: number }>;
    automation_usage: Array<{ task: string; automation_rate: number }>;
    client_satisfaction: number;
  } {
    // Would query actual database metrics
    return {
      total_workflows: 25,
      average_completion_time: 90, // days
      success_rate: 0.92,
      common_bottlenecks: [{ stage: 'court_proceedings', average_delay: 7 }],
      automation_usage: [{ task: 'letter_before_action', automation_rate: 0.85 }],
      client_satisfaction: 4.2,
    };
  }
}

// Create singleton instance
export const workflowEngineService = new WorkflowEngineService();
