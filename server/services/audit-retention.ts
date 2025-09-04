import cron from 'node-cron';
import { storage } from '../storage';
import { AuditEventType, auditLogger, AuditSeverity } from '../utils/audit-logger';

interface RetentionPolicy {
  name: string;
  retentionDays: number;
  enabled: boolean;
  schedule?: string; // cron schedule
  description: string;
}

// UK Legal compliance: 7 years retention for legal documents
const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    name: 'uk-legal-compliance',
    retentionDays: 7 * 365, // 7 years
    enabled: true,
    schedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
    description: 'UK legal compliance: 7 years retention for legal case data',
  },
  {
    name: 'security-logs',
    retentionDays: 2 * 365, // 2 years for security logs
    enabled: true,
    schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
    description: 'Security audit logs retention: 2 years',
  },
  {
    name: 'system-logs',
    retentionDays: 90, // 3 months for general system logs
    enabled: true,
    schedule: '0 4 * * *', // Daily at 4 AM
    description: 'General system logs retention: 90 days',
  },
];

export class AuditRetentionService {
  private policies: RetentionPolicy[] = [];
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.policies = [...DEFAULT_RETENTION_POLICIES];
    this.initializeScheduledJobs();
  }

  /**
   * Initialize scheduled cleanup jobs based on retention policies
   */
  private initializeScheduledJobs(): void {
    this.policies.forEach((policy) => {
      if (policy.enabled && policy.schedule) {
        try {
          const task = cron.schedule(
            policy.schedule,
            async () => {
              await this.executeRetentionPolicy(policy.name);
            },
            {
              timezone: 'Europe/London', // UK timezone
            },
          );

          this.scheduledJobs.set(policy.name, task);

          auditLogger.log(AuditEventType.SYSTEM_START, AuditSeverity.INFO, 'SUCCESS', {
            resource: 'retention-service',
            action: 'SCHEDULE_CREATED',
            details: {
              policy: policy.name,
              schedule: policy.schedule,
              retentionDays: policy.retentionDays,
            },
          });
        } catch (error) {
          auditLogger.logError(error as Error, 'system', {
            operation: 'schedule-retention-policy',
            policy: policy.name,
          });
        }
      }
    });
  }

  /**
   * Start all scheduled retention jobs
   */
  public startScheduledJobs(): void {
    this.scheduledJobs.forEach((task, policyName) => {
      task.start();
      auditLogger.log(AuditEventType.SYSTEM_START, AuditSeverity.INFO, 'SUCCESS', {
        resource: 'retention-service',
        action: 'SCHEDULE_STARTED',
        details: { policy: policyName },
      });
    });
  }

  /**
   * Stop all scheduled retention jobs
   */
  public stopScheduledJobs(): void {
    this.scheduledJobs.forEach((task, policyName) => {
      task.stop();
      auditLogger.log(AuditEventType.SYSTEM_STOP, AuditSeverity.INFO, 'SUCCESS', {
        resource: 'retention-service',
        action: 'SCHEDULE_STOPPED',
        details: { policy: policyName },
      });
    });
  }

  /**
   * Execute a specific retention policy
   */
  public async executeRetentionPolicy(policyName: string): Promise<{
    policy: string;
    deleted: number;
    error?: string;
  }> {
    const policy = this.policies.find((p) => p.name === policyName);

    if (!policy) {
      const error = `Retention policy '${policyName}' not found`;
      auditLogger.log(AuditEventType.ERROR, AuditSeverity.ERROR, 'FAILURE', {
        resource: 'retention-service',
        action: 'POLICY_EXECUTION',
        errorMessage: error,
        details: { requestedPolicy: policyName },
      });
      return { policy: policyName, deleted: 0, error };
    }

    if (!policy.enabled) {
      const error = `Retention policy '${policyName}' is disabled`;
      auditLogger.log(AuditEventType.ERROR, AuditSeverity.WARNING, 'FAILURE', {
        resource: 'retention-service',
        action: 'POLICY_EXECUTION',
        errorMessage: error,
        details: { policy: policyName },
      });
      return { policy: policyName, deleted: 0, error };
    }

    try {
      auditLogger.log(AuditEventType.SYSTEM_START, AuditSeverity.INFO, 'SUCCESS', {
        resource: 'retention-service',
        action: 'POLICY_EXECUTION_START',
        details: {
          policy: policyName,
          retentionDays: policy.retentionDays,
          description: policy.description,
        },
      });

      const result = await storage.cleanupOldAuditLogs(policy.retentionDays);

      auditLogger.log(
        AuditEventType.DATA_DELETION,
        AuditSeverity.WARNING, // High visibility for data deletion
        'SUCCESS',
        {
          resource: 'audit-logs',
          action: 'RETENTION_CLEANUP',
          details: {
            policy: policyName,
            retentionDays: policy.retentionDays,
            deletedCount: result.deleted,
            executedAt: new Date().toISOString(),
          },
        },
      );

      return { policy: policyName, deleted: result.deleted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      auditLogger.logError(error as Error, 'system', {
        operation: 'retention-policy-execution',
        policy: policyName,
        retentionDays: policy.retentionDays,
      });

      return { policy: policyName, deleted: 0, error: errorMessage };
    }
  }

  /**
   * Execute all enabled retention policies manually
   */
  public async executeAllPolicies(): Promise<{
    executed: number;
    results: Array<{
      policy: string;
      deleted: number;
      error?: string;
    }>;
  }> {
    const enabledPolicies = this.policies.filter((p) => p.enabled);
    const results = [];

    for (const policy of enabledPolicies) {
      const result = await this.executeRetentionPolicy(policy.name);
      results.push(result);
    }

    auditLogger.log(AuditEventType.DATA_DELETION, AuditSeverity.INFO, 'SUCCESS', {
      resource: 'retention-service',
      action: 'BULK_POLICY_EXECUTION',
      details: {
        policiesExecuted: results.length,
        totalDeleted: results.reduce((sum, r) => sum + r.deleted, 0),
        results,
      },
    });

    return {
      executed: results.length,
      results,
    };
  }

  /**
   * Get current retention policies
   */
  public getPolicies(): RetentionPolicy[] {
    return [...this.policies];
  }

  /**
   * Update a retention policy
   */
  public updatePolicy(policyName: string, updates: Partial<RetentionPolicy>): boolean {
    const policyIndex = this.policies.findIndex((p) => p.name === policyName);

    if (policyIndex === -1) {
      return false;
    }

    const oldPolicy = { ...this.policies[policyIndex] };
    this.policies[policyIndex] = { ...this.policies[policyIndex], ...updates };

    // Update scheduled job if schedule changed
    if (updates.schedule && updates.schedule !== oldPolicy.schedule) {
      this.updateScheduledJob(policyName);
    }

    auditLogger.log(AuditEventType.CONFIG_CHANGE, AuditSeverity.WARNING, 'SUCCESS', {
      resource: 'retention-policy',
      action: 'POLICY_UPDATE',
      details: {
        policy: policyName,
        oldPolicy,
        newPolicy: this.policies[policyIndex],
      },
    });

    return true;
  }

  /**
   * Add a new retention policy
   */
  public addPolicy(policy: RetentionPolicy): boolean {
    if (this.policies.some((p) => p.name === policy.name)) {
      return false; // Policy already exists
    }

    this.policies.push(policy);

    if (policy.enabled && policy.schedule) {
      this.createScheduledJob(policy);
    }

    auditLogger.log(AuditEventType.CONFIG_CHANGE, AuditSeverity.WARNING, 'SUCCESS', {
      resource: 'retention-policy',
      action: 'POLICY_CREATED',
      details: { policy },
    });

    return true;
  }

  /**
   * Remove a retention policy
   */
  public removePolicy(policyName: string): boolean {
    const policyIndex = this.policies.findIndex((p) => p.name === policyName);

    if (policyIndex === -1) {
      return false;
    }

    const policy = this.policies[policyIndex];
    this.policies.splice(policyIndex, 1);

    // Stop and remove scheduled job
    const task = this.scheduledJobs.get(policyName);
    if (task) {
      task.stop();
      this.scheduledJobs.delete(policyName);
    }

    auditLogger.log(AuditEventType.CONFIG_CHANGE, AuditSeverity.WARNING, 'SUCCESS', {
      resource: 'retention-policy',
      action: 'POLICY_DELETED',
      details: { policy },
    });

    return true;
  }

  private updateScheduledJob(policyName: string): void {
    // Stop existing job
    const existingTask = this.scheduledJobs.get(policyName);
    if (existingTask) {
      existingTask.stop();
    }

    // Create new job
    const policy = this.policies.find((p) => p.name === policyName);
    if (policy && policy.enabled && policy.schedule) {
      this.createScheduledJob(policy);
    }
  }

  private createScheduledJob(policy: RetentionPolicy): void {
    if (!policy.schedule) return;

    try {
      const task = cron.schedule(
        policy.schedule,
        async () => {
          await this.executeRetentionPolicy(policy.name);
        },
        {
          timezone: 'Europe/London',
        },
      );

      this.scheduledJobs.set(policy.name, task);

      if (policy.enabled) {
        task.start();
      }
    } catch (error) {
      auditLogger.logError(error as Error, 'system', {
        operation: 'create-scheduled-job',
        policy: policy.name,
      });
    }
  }

  /**
   * Get retention statistics
   */
  public async getRetentionStats(): Promise<{
    policies: number;
    enabledPolicies: number;
    scheduledJobs: number;
    nextExecutions: Array<{
      policy: string;
      nextExecution: string | null;
      enabled: boolean;
    }>;
  }> {
    const nextExecutions = this.policies.map((policy) => {
      const task = this.scheduledJobs.get(policy.name);
      return {
        policy: policy.name,
        nextExecution: task ? null : null, // cron doesn't provide next execution time easily
        enabled: policy.enabled,
      };
    });

    return {
      policies: this.policies.length,
      enabledPolicies: this.policies.filter((p) => p.enabled).length,
      scheduledJobs: this.scheduledJobs.size,
      nextExecutions,
    };
  }
}

// Export singleton instance
export const retentionService = new AuditRetentionService();

// Auto-start retention service if not in test environment
if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_AUDIT_RETENTION !== 'false') {
  retentionService.startScheduledJobs();

  auditLogger.log(AuditEventType.SYSTEM_START, AuditSeverity.INFO, 'SUCCESS', {
    resource: 'retention-service',
    action: 'SERVICE_STARTED',
    details: {
      policiesLoaded: retentionService.getPolicies().length,
      environment: process.env.NODE_ENV,
    },
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  retentionService.stopScheduledJobs();
});

process.on('SIGTERM', () => {
  retentionService.stopScheduledJobs();
});

export default retentionService;
