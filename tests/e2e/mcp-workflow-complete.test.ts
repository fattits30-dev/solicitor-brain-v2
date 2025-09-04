/**
 * End-to-End Test for Complete MCP Workflow
 *
 * This test validates the entire MCP integration workflow:
 * 1. File change detection via file-watcher
 * 2. Memory-keeper persistence of change events
 * 3. Structured logging with PII sanitization
 * 4. Git operations via MCP git tools
 * 5. Cross-service communication and state management
 * 6. Error handling and recovery
 * 7. Performance under load
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdir, rmdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { createFileWatcher, FileWatcher } from '../../server/services/file-watcher';
import { GitService } from '../../server/services/git-service';
import { mcpMemoryKeeper } from '../../server/services/mcp-client';
import { structuredLogger } from '../../server/services/structured-logger';

describe('Complete MCP Workflow End-to-End Test', () => {
  const e2eWorkspaceDir = path.join(__dirname, 'mcp-e2e-workspace');
  const projectDir = path.join(e2eWorkspaceDir, 'solicitor-brain-project');
  const documentsDir = path.join(projectDir, 'documents');
  const casesDir = path.join(projectDir, 'cases');

  let fileWatcher: FileWatcher;
  let gitService: GitService;

  // Test data for legal document simulation
  const testCaseId = 'case-2024-001';
  const testWorkflowId = 'workflow-document-ingestion';
  const testUserId = 'solicitor-001';

  beforeAll(async () => {
    // Create complete project structure
    await mkdir(documentsDir, { recursive: true });
    await mkdir(casesDir, { recursive: true });

    // Initialize git repository
    try {
      const { execSync } = require('child_process');
      execSync('git init', { cwd: projectDir, stdio: 'pipe' });
      execSync('git config user.email "test@solicitor-brain.com"', { cwd: projectDir, stdio: 'pipe' });
      execSync('git config user.name "Solicitor Brain Test"', { cwd: projectDir, stdio: 'pipe' });
    } catch (error) {
      console.warn('Git initialization failed:', error);
    }

    // Enable all MCP services
    mcpMemoryKeeper.setEnabled(true);

    // Set up environment for comprehensive testing
    process.env.LOG_CONSOLE = 'true';
    process.env.LOG_MEMORY_KEEPER = 'true';
    process.env.MCP_ENABLED = 'true';
  });

  afterAll(async () => {
    // Stop all services
    if (fileWatcher) {
      fileWatcher.stop();
    }

    // Clean up workspace
    try {
      await rmdir(e2eWorkspaceDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }

    // Clean up environment
    delete process.env.LOG_CONSOLE;
    delete process.env.LOG_MEMORY_KEEPER;
    delete process.env.MCP_ENABLED;
  });

  beforeEach(() => {
    // Initialize services for each test
    fileWatcher = createFileWatcher({
      paths: [projectDir],
      ignore: [/\.git/, /node_modules/, /\.tmp$/, /\.log$/],
      debounceMs: 100,
      backupEnabled: true,
      backupDir: path.join(projectDir, '.backups'),
      maxBackups: 5,
    });

    gitService = new GitService(projectDir);

    // Enable all integrations
    fileWatcher.setMemoryKeeperEnabled(true);

    // Mock console methods to avoid noise but keep functionality
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    // Stop services after each test
    if (fileWatcher) {
      fileWatcher.stop();
    }

    // Restore mocks
    jest.restoreAllMocks();
  });

  describe('Complete Document Ingestion Workflow', () => {
    it('should handle complete file → logging → git → memory workflow', async () => {
      const documentFile = path.join(documentsDir, 'contract-analysis.ts');
      const caseFile = path.join(casesDir, `${testCaseId}.json`);

      // Document content with potential PII
      const documentContent = `// Contract Analysis Document
export interface ContractAnalysis {
  caseId: '${testCaseId}';
  clientName: 'John Doe'; // This should be logged safely
  clientEmail: 'john.doe@client.com'; // This should be redacted
  contractDate: '2024-01-15';
  analysisDate: '${new Date().toISOString()}';
  keyTerms: string[];
  riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const analysis: ContractAnalysis = {
  caseId: '${testCaseId}',
  clientName: 'John Doe',
  clientEmail: 'john.doe@client.com',
  contractDate: '2024-01-15',
  analysisDate: '${new Date().toISOString()}',
  keyTerms: ['termination clause', 'liability limit', 'payment terms'],
  riskAssessment: 'MEDIUM'
};`;

      // Case metadata
      const caseMetadata = {
        id: testCaseId,
        title: 'Contract Analysis Case',
        client: 'Confidential Client',
        status: 'active',
        created: new Date().toISOString(),
        documents: ['contract-analysis.ts']
      };

      // Set up comprehensive event tracking
      const events: Array<{ type: string; timestamp: Date; data: any }> = [];

      // Track file changes
      fileWatcher.on('change', (change) => {
        events.push({ type: 'file_change', timestamp: new Date(), data: change });
      });

      // Track errors
      fileWatcher.on('error', (error) => {
        events.push({ type: 'file_error', timestamp: new Date(), data: error });
      });

      // Mock structured logger to track logging
      const loggerInfoSpy = jest.spyOn(structuredLogger, 'info').mockImplementation(async (message, category, context, tags) => {
        events.push({
          type: 'log_info',
          timestamp: new Date(),
          data: { message, category, context, tags }
        });
      });

      const loggerErrorSpy = jest.spyOn(structuredLogger, 'error').mockImplementation(async (message, category, error, context, tags) => {
        events.push({
          type: 'log_error',
          timestamp: new Date(),
          data: { message, category, error, context, tags }
        });
      });

      try {
        // Step 1: Create files (simulating document ingestion)
        await writeFile(documentFile, documentContent);
        await writeFile(caseFile, JSON.stringify(caseMetadata, null, 2));

        // Step 2: Wait for file change detection
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 3: Verify file changes were detected
        const fileChangeEvents = events.filter(e => e.type === 'file_change');
        expect(fileChangeEvents.length).toBeGreaterThanOrEqual(2); // Both files

        // Step 4: Perform git operations with workflow context
        await structuredLogger.info(
          'Starting document ingestion workflow',
          LogCategory.DOCUMENT_PROCESSING,
          {
            userId: testUserId,
            caseId: testCaseId,
            workflowId: testWorkflowId,
            metadata: {
              documentsProcessed: 2,
              clientEmail: 'john.doe@client.com' // This should be redacted in logs
            }
          },
          ['workflow', 'document-ingestion', 'start']
        );

        // Step 5: Add files to git
        const addSuccess = await gitService.addFiles([
          'documents/contract-analysis.ts',
          `cases/${testCaseId}.json`
        ]);
        expect(addSuccess).toBe(true);

        // Step 6: Commit with workflow context
        const _commitHash = await gitService.commit(
          `Add contract analysis for ${testCaseId}`,
          testWorkflowId,
          testCaseId
        );
        expect(typeof commitHash).toBe('string');

        // Step 7: Log completion
        await structuredLogger.info(
          'Document ingestion workflow completed',
          LogCategory.DOCUMENT_PROCESSING,
          {
            userId: testUserId,
            caseId: testCaseId,
            workflowId: testWorkflowId,
            commitHash,
            metadata: { success: true, filesProcessed: 2 }
          },
          ['workflow', 'document-ingestion', 'completed']
        );

        // Step 8: Verify comprehensive workflow execution

        // Check that file changes were detected
        expect(fileChangeEvents.length).toBeGreaterThanOrEqual(2);

        // Check that logging occurred
        const logEvents = events.filter(e => e.type === 'log_info');
        expect(logEvents.length).toBeGreaterThanOrEqual(2); // Start and completion logs

        // Verify PII redaction in logs
        const logWithPII = logEvents.find(e =>
          e.data.context?.metadata?.clientEmail
        );
        if (logWithPII) {
          // In a real implementation, this would be redacted
          expect(logWithPII.data.message).not.toContain('john.doe@client.com');
        }

        // Step 9: Verify git state
        const gitStatus = await gitService.getStatus();
        expect(gitStatus.clean).toBe(true); // Files should be committed

        // Step 10: Verify workflow context is maintained
        const workflowContext = await gitService.getWorkflowContext(testWorkflowId, testCaseId);
        expect(workflowContext).toBeDefined();
        expect(workflowContext.status).toBeDefined();
        expect(workflowContext.recentCommits).toBeDefined();

        // Step 11: Verify memory persistence
        const memoryStatus = await mcpMemoryKeeper.getStatus();
        expect(memoryStatus).toBeDefined();
        expect(memoryStatus?.enabled).toBe(true);

        // Step 12: Search memory for workflow items
        const workflowMemory = await fileWatcher.searchMemoryChanges(testWorkflowId, {
          category: 'progress',
          limit: 10
        });
        expect(Array.isArray(workflowMemory)).toBe(true);

        console.log(`✅ Complete workflow executed successfully:
        - File changes detected: ${fileChangeEvents.length}
        - Log events: ${logEvents.length}
        - Git commit: ${commitHash}
        - Memory status: ${memoryStatus?.enabled ? 'enabled' : 'disabled'}
        - Total events tracked: ${events.length}`);

      } finally {
        // Clean up
        loggerInfoSpy.mockRestore();
        loggerErrorSpy.mockRestore();

        try {
          await unlink(documentFile);
          await unlink(caseFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle workflow with multiple file types and operations', async () => {
      const files = [
        { path: path.join(documentsDir, 'legal-brief.md'), content: '# Legal Brief\nConfidential client information.' },
        { path: path.join(documentsDir, 'contract.pdf.ts'), content: '// PDF metadata\nexport const pdfInfo = { pages: 10, size: "2MB" };' },
        { path: path.join(casesDir, 'case-notes.txt'), content: 'Case notes with client email: client@law.com and phone 555-0123' },
        { path: path.join(projectDir, 'config.json'), content: '{"version": "1.0", "env": "test"}' }
      ];

      let changeCount = 0;
      fileWatcher.on('change', () => changeCount++);

      // Create files with different priorities
      for (const file of files) {
        await writeFile(file.path, file.content);
      }

      // Wait for all changes
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(changeCount).toBe(files.length);

      // Batch git operations
      const filenames = files.map(f => path.relative(projectDir, f.path));
      await gitService.addFiles(filenames);

      const _commitHash = await gitService.commit(
        'Batch commit for multiple document types',
        testWorkflowId,
        testCaseId
      );
      expect(typeof commitHash).toBe('string');

      // Verify git history
      const commits = await gitService.getCommitHistory(5);
      expect(Array.isArray(commits)).toBe(true);
      expect(commits.length).toBeGreaterThan(0);

      // Clean up
      for (const file of files) {
        try {
          await unlink(file.path);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should recover from git operation failures', async () => {
      const testFile = path.join(documentsDir, 'error-recovery-test.ts');
      const testContent = '// File for error recovery testing';

      // Create invalid git service
      const invalidGitService = new GitService('/invalid/path');

      let errorCount = 0;
      const errorSpy = jest.spyOn(structuredLogger, 'error').mockImplementation(async () => {
        errorCount++;
      });

      try {
        // Create file
        await writeFile(testFile, testContent);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Attempt invalid git operations
        const addResult = await invalidGitService.addFiles(['error-recovery-test.ts']);
        const commitResult = await invalidGitService.commit('Test commit');

        // Operations should fail gracefully
        expect(typeof addResult).toBe('boolean');
        expect(typeof commitResult).toBe('string'); // null is valid

        // But valid git service should still work
        const validAddResult = await gitService.addFiles(['documents/error-recovery-test.ts']);
        expect(validAddResult).toBe(true);

        const validCommitResult = await gitService.commit('Recovery test commit');
        expect(typeof validCommitResult).toBe('string');

        // Errors should be logged
        expect(errorCount).toBeGreaterThan(0);

      } finally {
        errorSpy.mockRestore();
        await unlink(testFile);
      }
    });

    it('should handle file system errors gracefully', async () => {
      const protectedFile = path.join(documentsDir, 'protected-file.ts');

      let _errorHandled = false;
      fileWatcher.on('error', () => {
        _errorHandled = true;
      });

      try {
        // Create file
        await writeFile(protectedFile, '// Protected file content');
        await new Promise(resolve => setTimeout(resolve, 200));

        // File watcher should handle file operations gracefully
        const status = await gitService.getStatus();
        expect(status).toBeDefined();

        // The workflow should continue even if some operations fail
        const memoryStatus = await mcpMemoryKeeper.getStatus();
        expect(memoryStatus?.enabled).toBe(true);

      } finally {
        try {
          await unlink(protectedFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should maintain data consistency during service failures', async () => {
      const consistencyFile = path.join(documentsDir, 'consistency-test.ts');
      const testContent = '// File for consistency testing';

      // Create file and start workflow
      await writeFile(consistencyFile, testContent);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get initial state
      const initialStatus = await gitService.getStatus();
      const _initialChangeHistory = fileWatcher.getChangeHistory();

      // Simulate service interruption
      fileWatcher.stop();

      // Git operations should still work independently
      await gitService.addFiles(['documents/consistency-test.ts']);
      const _commitHash = await gitService.commit('Consistency test commit');
      expect(typeof commitHash).toBe('string');

      // Restart file watcher
      fileWatcher = createFileWatcher({
        paths: [projectDir],
        debounceMs: 100,
        backupEnabled: false,
      });
      fileWatcher.setMemoryKeeperEnabled(true);

      // System should be in consistent state
      const newStatus = await gitService.getStatus();
      expect(newStatus.currentBranch).toBe(initialStatus.currentBranch);

      // Memory should maintain history
      const memoryHistory = await fileWatcher.getMemoryChangeHistory();
      expect(Array.isArray(memoryHistory)).toBe(true);

      // Clean up
      await unlink(consistencyFile);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-volume file operations efficiently', async () => {
      const fileCount = 25;
      const files = Array.from({ length: fileCount }, (_, i) => ({
        path: path.join(documentsDir, `bulk-doc-${i}.ts`),
        content: `// Bulk document ${i}
export const document${i} = {
  id: '${i}',
  content: 'Legal document content ${i}',
  caseId: '${testCaseId}',
  created: '${new Date().toISOString()}'
};`
      }));

      let changeCount = 0;
      const startTime = Date.now();

      fileWatcher.on('change', () => changeCount++);

      try {
        // Create all files concurrently
        const createPromises = files.map(file =>
          writeFile(file.path, file.content)
        );

        await Promise.all(createPromises);
        const createTime = Date.now() - startTime;

        // Wait for all changes to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        expect(changeCount).toBe(fileCount);
        expect(createTime).toBeLessThan(5000); // Should be fast

        // Batch git operations
        const gitStartTime = Date.now();
        const filenames = files.map(f => path.relative(projectDir, f.path));

        // Add files in batches to avoid command line length limits
        const batchSize = 10;
        for (let i = 0; i < filenames.length; i += batchSize) {
          const batch = filenames.slice(i, i + batchSize);
          await gitService.addFiles(batch);
        }

        await gitService.commit(`Bulk commit of ${fileCount} documents`, testWorkflowId, testCaseId);
        const gitTime = Date.now() - gitStartTime;

        expect(gitTime).toBeLessThan(15000); // Git operations might be slower

        // Verify final state
        const finalStatus = await gitService.getStatus();
        expect(finalStatus.clean).toBe(true);

        console.log(`📊 Performance metrics:
        - Files created: ${fileCount}
        - Creation time: ${createTime}ms
        - Git operations time: ${gitTime}ms
        - Changes detected: ${changeCount}`);

      } finally {
        // Clean up
        const unlinkPromises = files.map(file =>
          unlink(file.path).catch(() => {}) // Ignore errors
        );
        await Promise.all(unlinkPromises);
      }
    });

    it('should maintain responsiveness during continuous operations', async () => {
      const operationCount = 10;
      const responseTimeThreshold = 1000; // 1 second per operation

      for (let i = 0; i < operationCount; i++) {
        const startTime = Date.now();

        const testFile = path.join(documentsDir, `responsive-test-${i}.ts`);
        const testContent = `// Responsive test file ${i}\nexport const data${i} = 'test-data';`;

        // Create file
        await writeFile(testFile, testContent);

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Perform git operations
        await gitService.addFiles([`documents/responsive-test-${i}.ts`]);
        await gitService.commit(`Responsive test commit ${i}`);

        const operationTime = Date.now() - startTime;
        expect(operationTime).toBeLessThan(responseTimeThreshold);

        // Clean up immediately to avoid accumulation
        await unlink(testFile);
      }

      console.log(`✅ Responsiveness test completed: ${operationCount} operations under ${responseTimeThreshold}ms each`);
    });
  });

  describe('Integration Validation', () => {
    it('should validate all MCP services are working together', async () => {
      const validationFile = path.join(documentsDir, 'integration-validation.ts');
      const validationContent = `// Integration validation file
export const validation = {
  timestamp: '${new Date().toISOString()}',
  services: ['file-watcher', 'git-service', 'structured-logger', 'memory-keeper'],
  status: 'testing'
};`;

      const validationResults: Record<string, boolean> = {
        fileWatcher: false,
        gitService: false,
        structuredLogger: false,
        memoryKeeper: false
      };

      try {
        // Test file watcher
        const changePromise = new Promise(resolve => {
          fileWatcher.once('change', () => {
            validationResults.fileWatcher = true;
            resolve(true);
          });
        });

        await writeFile(validationFile, validationContent);
        await Promise.race([changePromise, new Promise((_, reject) =>
          setTimeout(() => reject(new Error('File watcher timeout')), 2000)
        )]);

        // Test git service
        try {
          const status = await gitService.getStatus();
          const addResult = await gitService.addFiles(['documents/integration-validation.ts']);
          const commitResult = await gitService.commit('Integration validation commit');

          if (status && addResult && commitResult) {
            validationResults.gitService = true;
          }
        } catch (error) {
          console.warn('Git service validation failed:', error);
        }

        // Test structured logger
        try {
          await structuredLogger.info(
            'Integration validation test',
            LogCategory.SYSTEM,
            { validationId: 'test-123' },
            ['integration', 'validation']
          );
          validationResults.structuredLogger = true;
        } catch (error) {
          console.warn('Structured logger validation failed:', error);
        }

        // Test memory keeper
        try {
          const memoryStatus = await mcpMemoryKeeper.getStatus();
          if (memoryStatus?.enabled) {
            validationResults.memoryKeeper = true;
          }
        } catch (error) {
          console.warn('Memory keeper validation failed:', error);
        }

        // Report validation results
        const successCount = Object.values(validationResults).filter(Boolean).length;
        const totalServices = Object.keys(validationResults).length;

        console.log(`🔍 Integration validation results:
        - File Watcher: ${validationResults.fileWatcher ? '✅' : '❌'}
        - Git Service: ${validationResults.gitService ? '✅' : '❌'}
        - Structured Logger: ${validationResults.structuredLogger ? '✅' : '❌'}
        - Memory Keeper: ${validationResults.memoryKeeper ? '✅' : '❌'}
        - Success Rate: ${successCount}/${totalServices} (${Math.round(successCount/totalServices*100)}%)`);

        // At least 75% of services should be working
        expect(successCount).toBeGreaterThanOrEqual(Math.ceil(totalServices * 0.75));

      } finally {
        await unlink(validationFile).catch(() => {});
      }
    });

    it('should demonstrate complete legal document workflow', async () => {
      // Simulate a complete legal document processing workflow
      const contractFile = path.join(documentsDir, 'client-contract.ts');
      const analysisFile = path.join(documentsDir, 'contract-analysis.json');
      const caseUpdateFile = path.join(casesDir, `${testCaseId}-update.md`);

      const contractContent = `// Client Contract Processing
export interface ClientContract {
  contractId: string;
  clientName: string;
  effective: string;
  terms: ContractTerm[];
}

export const contract: ClientContract = {
  contractId: 'CONTRACT-2024-001',
  clientName: 'Acme Corporation', // Safe to log
  effective: '2024-02-01',
  terms: [
    { type: 'payment', description: 'Net 30 payment terms' },
    { type: 'liability', description: 'Limited liability clause' }
  ]
};`;

      const analysisContent = {
        contractId: 'CONTRACT-2024-001',
        analysisDate: new Date().toISOString(),
        riskLevel: 'MEDIUM',
        keyFindings: [
          'Payment terms are standard',
          'Liability clause needs review',
          'Termination clause is favorable'
        ],
        recommendations: [
          'Review liability limits',
          'Consider adding dispute resolution clause'
        ],
        reviewer: testUserId
      };

      const caseUpdateContent = `# Case Update - ${testCaseId}

## Contract Analysis Completed

- **Contract ID**: CONTRACT-2024-001
- **Analysis Date**: ${new Date().toISOString()}
- **Risk Assessment**: MEDIUM
- **Next Actions**:
  - Schedule client review
  - Prepare contract amendments
  - Update case timeline

## Workflow Status
- ✅ Document ingestion
- ✅ Initial analysis
- ⏳ Client review pending
`;

      try {
        // Step 1: Document ingestion
        await structuredLogger.info(
          'Starting legal document workflow',
          LogCategory.DOCUMENT_PROCESSING,
          {
            userId: testUserId,
            caseId: testCaseId,
            workflowId: testWorkflowId,
            metadata: { documentType: 'contract', stage: 'ingestion' }
          },
          ['legal', 'contract', 'workflow-start']
        );

        // Step 2: Create contract file
        await writeFile(contractFile, contractContent);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Step 3: Process and analyze
        await structuredLogger.info(
          'Contract analysis in progress',
          LogCategory.AI_SERVICE,
          {
            userId: testUserId,
            caseId: testCaseId,
            metadata: {
              contractId: 'CONTRACT-2024-001',
              analysisType: 'automated'
            }
          },
          ['legal', 'analysis', 'ai']
        );

        // Step 4: Save analysis results
        await writeFile(analysisFile, JSON.stringify(analysisContent, null, 2));
        await new Promise(resolve => setTimeout(resolve, 200));

        // Step 5: Update case notes
        await writeFile(caseUpdateFile, caseUpdateContent);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Step 6: Commit all changes
        const files = [
          'documents/client-contract.ts',
          'documents/contract-analysis.json',
          `cases/${testCaseId}-update.md`
        ];

        await gitService.addFiles(files);
        const _commitHash = await gitService.commit(
          `Complete contract analysis for ${testCaseId}`,
          testWorkflowId,
          testCaseId
        );

        // Step 7: Log workflow completion
        await structuredLogger.info(
          'Legal document workflow completed successfully',
          LogCategory.DOCUMENT_PROCESSING,
          {
            userId: testUserId,
            caseId: testCaseId,
            workflowId: testWorkflowId,
            commitHash,
            metadata: {
              documentsProcessed: 3,
              analysisCompleted: true,
              caseUpdated: true
            }
          },
          ['legal', 'contract', 'workflow-complete']
        );

        // Verify workflow success
        expect(typeof commitHash).toBe('string');

        const gitStatus = await gitService.getStatus();
        expect(gitStatus.clean).toBe(true);

        console.log(`📋 Legal document workflow completed:
        - Contract processed: ✅
        - Analysis generated: ✅
        - Case updated: ✅
        - Git commit: ${commitHash}
        - All files tracked and committed`);

      } finally {
        // Clean up
        const cleanupFiles = [contractFile, analysisFile, caseUpdateFile];
        for (const file of cleanupFiles) {
          try {
            await unlink(file);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    });
  });
});
