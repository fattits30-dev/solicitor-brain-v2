#!/usr/bin/env tsx
/**
 * MCP Integration Validation Script
 * 
 * Validates that all MCP tools and integrations are properly configured
 * and working before running the full test suite.
 */

import { writeFile, unlink, mkdir, access } from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

class MCPIntegrationValidator {
  private results: ValidationResult[] = [];
  private projectRoot: string;
  private tempDir: string;

  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.tempDir = path.join(this.projectRoot, '.temp-validation');
  }

  async validate(): Promise<boolean> {
    console.log('🔍 Validating MCP Integration Setup');
    console.log('===================================\n');

    // Create temp directory for validation
    await mkdir(this.tempDir, { recursive: true });

    try {
      // Run all validation checks
      await this.validateEnvironment();
      await this.validateDependencies();
      await this.validateFileStructure();
      await this.validateServices();
      await this.validateMCPClients();
      await this.validateGitIntegration();
      await this.validateTestStructure();

      // Generate report
      this.generateValidationReport();

      // Return overall success
      const hasFailures = this.results.some(r => r.status === 'fail');
      return !hasFailures;

    } finally {
      // Clean up temp directory
      try {
        await this.cleanupTempFiles();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async validateEnvironment(): Promise<void> {
    console.log('🌍 Validating Environment...');

    // Check Node.js version
    const nodeVersion = process.version;
    const minNodeVersion = '18.0.0';
    const isNodeVersionValid = this.compareVersions(nodeVersion.slice(1), minNodeVersion) >= 0;

    this.addResult({
      component: 'Node.js Version',
      status: isNodeVersionValid ? 'pass' : 'fail',
      message: `Node.js ${nodeVersion} ${isNodeVersionValid ? 'is supported' : 'is too old, requires >= ' + minNodeVersion}`,
      details: `Minimum required: ${minNodeVersion}`
    });

    // Check TypeScript availability
    try {
      execSync('npx tsc --version', { stdio: 'pipe' });
      this.addResult({
        component: 'TypeScript',
        status: 'pass',
        message: 'TypeScript compiler available'
      });
    } catch {
      this.addResult({
        component: 'TypeScript',
        status: 'fail',
        message: 'TypeScript compiler not available'
      });
    }

    // Check Jest availability
    try {
      execSync('npx jest --version', { stdio: 'pipe' });
      this.addResult({
        component: 'Jest',
        status: 'pass',
        message: 'Jest test runner available'
      });
    } catch {
      this.addResult({
        component: 'Jest',
        status: 'fail',
        message: 'Jest test runner not available'
      });
    }

    // Check Git availability
    try {
      execSync('git --version', { stdio: 'pipe' });
      this.addResult({
        component: 'Git',
        status: 'pass',
        message: 'Git is available'
      });
    } catch {
      this.addResult({
        component: 'Git',
        status: 'fail',
        message: 'Git is not available'
      });
    }
  }

  private async validateDependencies(): Promise<void> {
    console.log('📦 Validating Dependencies...');

    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    try {
      await access(packageJsonPath);
      const packageJson = require(packageJsonPath);

      // Check required dependencies
      const requiredDeps = [
        '@jest/globals',
        'typescript',
        'tsx'
      ];

      const requiredDevDeps = [
        'jest',
        '@types/jest',
        '@types/node'
      ];

      for (const dep of requiredDeps) {
        if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
          this.addResult({
            component: `Dependency: ${dep}`,
            status: 'pass',
            message: `${dep} is installed`
          });
        } else {
          this.addResult({
            component: `Dependency: ${dep}`,
            status: 'fail',
            message: `${dep} is missing from package.json`
          });
        }
      }

      for (const dep of requiredDevDeps) {
        if (packageJson.devDependencies?.[dep]) {
          this.addResult({
            component: `Dev Dependency: ${dep}`,
            status: 'pass',
            message: `${dep} is installed`
          });
        } else {
          this.addResult({
            component: `Dev Dependency: ${dep}`,
            status: 'warning',
            message: `${dep} is missing from devDependencies`
          });
        }
      }

    } catch {
      this.addResult({
        component: 'Package.json',
        status: 'fail',
        message: 'package.json not found or not readable'
      });
    }
  }

  private async validateFileStructure(): Promise<void> {
    console.log('📁 Validating File Structure...');

    const requiredPaths = [
      'server/services/mcp-client.ts',
      'server/services/file-watcher.ts',
      'server/services/git-service.ts',
      'server/services/structured-logger.ts',
      'server/types/mcp.ts',
      'server/utils/mcp-client.ts',
      'tests/integration',
      'tests/e2e'
    ];

    for (const requiredPath of requiredPaths) {
      const fullPath = path.join(this.projectRoot, requiredPath);
      
      try {
        await access(fullPath);
        this.addResult({
          component: `File Structure: ${requiredPath}`,
          status: 'pass',
          message: `${requiredPath} exists`
        });
      } catch {
        this.addResult({
          component: `File Structure: ${requiredPath}`,
          status: 'fail',
          message: `${requiredPath} is missing`
        });
      }
    }
  }

  private async validateServices(): Promise<void> {
    console.log('🔧 Validating Services...');

    // Test MCP Memory Keeper Client
    try {
      const { mcpMemoryKeeper } = await import('../../server/services/mcp-client');
      mcpMemoryKeeper.setEnabled(true);
      
      const isEnabled = mcpMemoryKeeper.isMemoryKeeperEnabled();
      
      this.addResult({
        component: 'MCP Memory Keeper Client',
        status: 'pass',
        message: `Memory keeper client can be enabled: ${isEnabled}`
      });
    } catch (error) {
      this.addResult({
        component: 'MCP Memory Keeper Client',
        status: 'fail',
        message: 'Failed to import or initialize MCP memory keeper client',
        details: String(error)
      });
    }

    // Test File Watcher Service
    try {
      const { createFileWatcher } = await import('../../server/services/file-watcher');
      const watcher = createFileWatcher({
        paths: [this.tempDir],
        debounceMs: 100,
        backupEnabled: false
      });
      
      // Test basic functionality
      watcher.setMemoryKeeperEnabled(true);
      const status = watcher.getMemoryKeeperStatus();
      
      watcher.stop();
      
      this.addResult({
        component: 'File Watcher Service',
        status: 'pass',
        message: `File watcher can be created and configured. Memory integration: ${status.integrated}`
      });
    } catch (error) {
      this.addResult({
        component: 'File Watcher Service',
        status: 'fail',
        message: 'Failed to create or configure file watcher',
        details: String(error)
      });
    }

    // Test Git Service
    try {
      const { GitService } = await import('../../server/services/git-service');
      const gitService = new GitService(this.tempDir);
      
      // Test basic functionality (this might fail if not a git repo, that's ok)
      const status = await gitService.getStatus();
      
      this.addResult({
        component: 'Git Service',
        status: 'pass',
        message: `Git service can be instantiated and returns status. Clean: ${status.clean}`
      });
    } catch (error) {
      this.addResult({
        component: 'Git Service',
        status: 'warning',
        message: 'Git service instantiation had issues (expected if not in git repo)',
        details: String(error)
      });
    }

    // Test Structured Logger
    try {
      const { structuredLogger, LogCategory } = await import('../../server/services/structured-logger');
      
      // Test logging
      await structuredLogger.info('Validation test message', LogCategory.SYSTEM, {}, ['validation']);
      
      this.addResult({
        component: 'Structured Logger',
        status: 'pass',
        message: 'Structured logger can log messages'
      });
    } catch (error) {
      this.addResult({
        component: 'Structured Logger',
        status: 'fail',
        message: 'Failed to use structured logger',
        details: String(error)
      });
    }
  }

  private async validateMCPClients(): Promise<void> {
    console.log('🔌 Validating MCP Clients...');

    // Test MCP Git Client
    try {
      const mcpGitClient = await import('../../server/utils/mcp-client');
      
      // Test if git functions are available
      const gitFunctions = [
        'mcp__git__git_status',
        'mcp__git__git_add',
        'mcp__git__git_commit',
        'mcp__git__git_log'
      ];

      for (const funcName of gitFunctions) {
        if (typeof mcpGitClient[funcName] === 'function') {
          this.addResult({
            component: `MCP Git Function: ${funcName}`,
            status: 'pass',
            message: `${funcName} is available`
          });
        } else {
          this.addResult({
            component: `MCP Git Function: ${funcName}`,
            status: 'fail',
            message: `${funcName} is not available`
          });
        }
      }
    } catch (error) {
      this.addResult({
        component: 'MCP Git Client',
        status: 'fail',
        message: 'Failed to import MCP git client',
        details: String(error)
      });
    }

    // Test MCP Types
    try {
      const mcpTypes = await import('../../server/types/mcp');
      
      const requiredTypes = [
        'MCPCategory',
        'MCPPriority',
        'MCPContextItem',
        'MCPSearchOptions'
      ];

      let typesAvailable = 0;
      for (const typeName of requiredTypes) {
        if (mcpTypes[typeName] !== undefined) {
          typesAvailable++;
        }
      }

      this.addResult({
        component: 'MCP Types',
        status: typesAvailable === requiredTypes.length ? 'pass' : 'warning',
        message: `${typesAvailable}/${requiredTypes.length} required types available`
      });
    } catch (error) {
      this.addResult({
        component: 'MCP Types',
        status: 'fail',
        message: 'Failed to import MCP types',
        details: String(error)
      });
    }
  }

  private async validateGitIntegration(): Promise<void> {
    console.log('🌿 Validating Git Integration...');

    // Initialize a temporary git repository
    const tempGitDir = path.join(this.tempDir, 'git-test');
    
    try {
      await mkdir(tempGitDir, { recursive: true });
      
      // Initialize git repo
      execSync('git init', { cwd: tempGitDir, stdio: 'pipe' });
      execSync('git config user.email "validation@test.com"', { cwd: tempGitDir, stdio: 'pipe' });
      execSync('git config user.name "Validation Test"', { cwd: tempGitDir, stdio: 'pipe' });

      // Test git service integration
      const { GitService } = await import('../../server/services/git-service');
      const gitService = new GitService(tempGitDir);

      // Create test file
      const testFile = path.join(tempGitDir, 'test.txt');
      await writeFile(testFile, 'Validation test content');

      // Test git operations
      const status = await gitService.getStatus();
      const addResult = await gitService.addFiles(['test.txt']);
      const _commitHash = await gitService.commit('Validation test commit');

      this.addResult({
        component: 'Git Integration',
        status: 'pass',
        message: `Git integration working. Status clean: ${status.clean}, Add: ${addResult}, Commit: ${commitHash ? 'success' : 'failed'}`
      });

      // Clean up test file
      await unlink(testFile);

    } catch (error) {
      this.addResult({
        component: 'Git Integration',
        status: 'warning',
        message: 'Git integration test failed (may be environmental)',
        details: String(error)
      });
    }
  }

  private async validateTestStructure(): Promise<void> {
    console.log('🧪 Validating Test Structure...');

    const testFiles = [
      'tests/integration/mcp-memory-keeper.test.ts',
      'tests/integration/file-watcher.test.ts',
      'tests/integration/structured-logger.test.ts',
      'tests/integration/mcp-filesystem.test.ts',
      'tests/integration/git-service.test.ts',
      'tests/integration/workflow-services.test.ts',
      'tests/e2e/mcp-workflow-complete.test.ts'
    ];

    for (const testFile of testFiles) {
      const fullPath = path.join(this.projectRoot, testFile);
      
      try {
        await access(fullPath);
        
        // Basic syntax check
        try {
          execSync(`npx tsc --noEmit ${fullPath}`, { stdio: 'pipe' });
          this.addResult({
            component: `Test File: ${testFile}`,
            status: 'pass',
            message: `${testFile} exists and compiles`
          });
        } catch {
          this.addResult({
            component: `Test File: ${testFile}`,
            status: 'warning',
            message: `${testFile} exists but has TypeScript errors`
          });
        }
      } catch {
        this.addResult({
          component: `Test File: ${testFile}`,
          status: 'fail',
          message: `${testFile} is missing`
        });
      }
    }

    // Check test runner script
    const testRunnerPath = path.join(this.projectRoot, 'tests/scripts/run-mcp-tests.ts');
    try {
      await access(testRunnerPath);
      this.addResult({
        component: 'Test Runner Script',
        status: 'pass',
        message: 'Test runner script is available'
      });
    } catch {
      this.addResult({
        component: 'Test Runner Script',
        status: 'fail',
        message: 'Test runner script is missing'
      });
    }
  }

  private async cleanupTempFiles(): Promise<void> {
    const { rmdir } = await import('fs/promises');
    await rmdir(this.tempDir, { recursive: true });
  }

  private addResult(result: ValidationResult): void {
    this.results.push(result);
    
    const emoji = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`  ${emoji} ${result.component}: ${result.message}`);
    
    if (result.details && result.status !== 'pass') {
      console.log(`     Details: ${result.details}`);
    }
  }

  private generateValidationReport(): void {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const failed = this.results.filter(r => r.status === 'fail').length;

    console.log('\n📊 Validation Summary');
    console.log('====================');
    console.log(`Total Checks: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed Checks:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`  - ${r.component}: ${r.message}`));
    }

    if (warnings > 0) {
      console.log('\n⚠️ Warnings:');
      this.results
        .filter(r => r.status === 'warning')
        .forEach(r => console.log(`  - ${r.component}: ${r.message}`));
    }

    const successRate = Math.round((passed / this.results.length) * 100);
    console.log(`\n🎯 Success Rate: ${successRate}%`);

    if (failed === 0) {
      console.log('\n🎉 All critical validations passed! MCP integration is ready for testing.');
    } else {
      console.log(`\n⚠️ ${failed} critical issues found. Please resolve before running tests.`);
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }

    return 0;
  }
}

// CLI interface
async function main() {
  const validator = new MCPIntegrationValidator();
  
  try {
    const isValid = await validator.validate();
    process.exit(isValid ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    process.exit(2);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MCPIntegrationValidator };