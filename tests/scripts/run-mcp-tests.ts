#!/usr/bin/env tsx
/**
 * MCP Integration Test Runner
 * 
 * Comprehensive test runner for all MCP tools integration tests.
 * Provides detailed reporting and validation of MCP functionality.
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';

interface TestResult {
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  details?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

interface TestSuite {
  name: string;
  description: string;
  path: string;
  timeout: number;
  critical: boolean;
}

class MCPTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;
  private projectRoot: string;
  private testOutputDir: string;

  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.testOutputDir = path.join(this.projectRoot, 'test-results/mcp-integration');
  }

  private readonly testSuites: TestSuite[] = [
    {
      name: 'MCP Memory-Keeper Integration',
      description: 'Tests memory-keeper MCP client functionality',
      path: 'tests/integration/mcp-memory-keeper.test.ts',
      timeout: 30000,
      critical: true
    },
    {
      name: 'File Watcher Integration',
      description: 'Tests file watcher with MCP memory-keeper integration',
      path: 'tests/integration/file-watcher.test.ts',
      timeout: 45000,
      critical: true
    },
    {
      name: 'Structured Logger Integration',
      description: 'Tests structured logging with MCP persistence',
      path: 'tests/integration/structured-logger.test.ts',
      timeout: 30000,
      critical: true
    },
    {
      name: 'MCP Filesystem Operations',
      description: 'Tests MCP filesystem wrapper functionality',
      path: 'tests/integration/mcp-filesystem.test.ts',
      timeout: 30000,
      critical: false
    },
    {
      name: 'Git Service Integration',
      description: 'Tests git service wrapper with MCP git tools',
      path: 'tests/integration/git-service.test.ts',
      timeout: 45000,
      critical: true
    },
    {
      name: 'Workflow Services Integration',
      description: 'Tests integration between workflow services',
      path: 'tests/integration/workflow-services.test.ts',
      timeout: 60000,
      critical: true
    },
    {
      name: 'Complete MCP Workflow E2E',
      description: 'End-to-end test of complete MCP workflow',
      path: 'tests/e2e/mcp-workflow-complete.test.ts',
      timeout: 120000,
      critical: true
    }
  ];

  async run(): Promise<void> {
    this.startTime = Date.now();
    
    console.log('🚀 Starting MCP Integration Test Suite');
    console.log('=====================================\n');

    // Create output directory
    await mkdir(this.testOutputDir, { recursive: true });

    // Set up environment
    await this.setupTestEnvironment();

    // Run test suites
    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    // Generate report
    await this.generateReport();

    // Exit with appropriate code
    const hasFailures = this.results.some(r => r.status === 'failed');
    const hasCriticalFailures = this.results.some(r => r.status === 'failed' && 
      this.testSuites.find(s => s.name === r.suite)?.critical);

    if (hasCriticalFailures) {
      console.log('❌ Critical test failures detected. Exiting with error code 1.');
      process.exit(1);
    } else if (hasFailures) {
      console.log('⚠️ Some tests failed, but no critical failures. Exiting with warning code 2.');
      process.exit(2);
    } else {
      console.log('✅ All tests passed successfully!');
      process.exit(0);
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('🛠️ Setting up test environment...');

    // Set environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.MCP_ENABLED = 'true';
    process.env.LOG_CONSOLE = 'false'; // Reduce noise during tests
    process.env.LOG_MEMORY_KEEPER = 'true';

    // Ensure test database is available (if needed)
    try {
      // You might want to set up a test database here
      console.log('  ✓ Environment variables set');
    } catch (error) {
      console.warn('  ⚠️ Some environment setup failed:', error);
    }

    // Install dependencies if needed
    try {
      execSync('npm ci', { cwd: this.projectRoot, stdio: 'pipe' });
      console.log('  ✓ Dependencies installed');
    } catch (error) {
      console.warn('  ⚠️ Dependency installation failed:', error);
    }

    console.log('');
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`📋 Running: ${suite.name}`);
    console.log(`   ${suite.description}`);

    const startTime = Date.now();
    
    try {
      const testPath = path.join(this.projectRoot, suite.path);
      
      // Run the test using Jest
      const result = await this.executeJestTest(testPath, suite.timeout);
      
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`   ✅ Passed (${duration}ms)`);
        
        this.results.push({
          suite: suite.name,
          status: 'passed',
          duration,
          details: result.details
        });
      } else {
        console.log(`   ❌ Failed (${duration}ms)`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        
        this.results.push({
          suite: suite.name,
          status: 'failed',
          duration,
          error: result.error,
          details: result.details
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   💥 Error (${duration}ms): ${error}`);
      
      this.results.push({
        suite: suite.name,
        status: 'failed',
        duration,
        error: String(error)
      });
    }

    console.log('');
  }

  private async executeJestTest(testPath: string, timeout: number): Promise<{
    success: boolean;
    error?: string;
    details?: { total: number; passed: number; failed: number; skipped: number };
  }> {
    return new Promise((resolve) => {
      const jestArgs = [
        testPath,
        '--testTimeout', timeout.toString(),
        '--verbose',
        '--no-coverage',
        '--detectOpenHandles',
        '--forceExit'
      ];

      const child = spawn('npx', ['jest', ...jestArgs], {
        cwd: this.projectRoot,
        stdio: 'pipe',
        timeout: timeout + 10000 // Add buffer to Jest timeout
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        const success = code === 0;
        
        // Parse Jest output for details
        const details = this.parseJestOutput(output);
        
        resolve({
          success,
          error: success ? undefined : (errorOutput || 'Test execution failed'),
          details
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start test: ${error.message}`
        });
      });

      // Handle timeout
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          resolve({
            success: false,
            error: 'Test timed out'
          });
        }
      }, timeout + 15000);
    });
  }

  private parseJestOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  } {
    // Parse Jest output to extract test statistics
    const passMatch = output.match(/(\d+) passing/);
    const failMatch = output.match(/(\d+) failing/);
    const skipMatch = output.match(/(\d+) skipped/);
    const totalMatch = output.match(/Tests:\s+(\d+)/);

    const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
    const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
    const skipped = skipMatch ? parseInt(skipMatch[1], 10) : 0;
    const total = totalMatch ? parseInt(totalMatch[1], 10) : passed + failed + skipped;

    return { total, passed, failed, skipped };
  }

  private async generateReport(): Promise<void> {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.reduce((sum, r) => sum + (r.details?.total || 0), 0);
    const totalPassed = this.results.reduce((sum, r) => sum + (r.details?.passed || 0), 0);
    const totalFailed = this.results.reduce((sum, r) => sum + (r.details?.failed || 0), 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + (r.details?.skipped || 0), 0);

    const passedSuites = this.results.filter(r => r.status === 'passed').length;
    const failedSuites = this.results.filter(r => r.status === 'failed').length;

    const report = {
      summary: {
        totalDuration,
        suites: {
          total: this.results.length,
          passed: passedSuites,
          failed: failedSuites
        },
        tests: {
          total: totalTests,
          passed: totalPassed,
          failed: totalFailed,
          skipped: totalSkipped
        }
      },
      results: this.results,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        mcpEnabled: process.env.MCP_ENABLED,
        testMode: process.env.NODE_ENV
      }
    };

    // Write JSON report
    const jsonReportPath = path.join(this.testOutputDir, 'mcp-test-results.json');
    await writeFile(jsonReportPath, JSON.stringify(report, null, 2));

    // Generate console summary
    console.log('📊 MCP Integration Test Results');
    console.log('================================');
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Test Suites: ${passedSuites}/${this.results.length} passed`);
    console.log(`Tests: ${totalPassed}/${totalTests} passed`);
    
    if (totalFailed > 0) {
      console.log(`❌ Failed: ${totalFailed}`);
    }
    if (totalSkipped > 0) {
      console.log(`⏭️ Skipped: ${totalSkipped}`);
    }

    console.log('\nSuite Details:');
    console.log('--------------');
    
    for (const result of this.results) {
      const suite = this.testSuites.find(s => s.name === result.suite);
      const criticalBadge = suite?.critical ? ' [CRITICAL]' : '';
      const statusEmoji = result.status === 'passed' ? '✅' : '❌';
      
      console.log(`${statusEmoji} ${result.suite}${criticalBadge}`);
      console.log(`   Duration: ${result.duration}ms`);
      
      if (result.details) {
        console.log(`   Tests: ${result.details.passed}/${result.details.total} passed`);
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error.split('\n')[0]}`);
      }
    }

    console.log(`\n📄 Detailed report saved to: ${jsonReportPath}`);

    // Generate HTML report if requested
    if (process.env.GENERATE_HTML_REPORT === 'true') {
      await this.generateHTMLReport(report);
    }
  }

  private async generateHTMLReport(report: any): Promise<void> {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .passed { border-left: 4px solid #28a745; }
        .failed { border-left: 4px solid #dc3545; }
        .skipped { border-left: 4px solid #ffc107; }
        .test-suite { margin: 15px 0; padding: 15px; border: 1px solid #eee; border-radius: 5px; }
        .critical { border-left: 4px solid #ff6b35; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>MCP Integration Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
        <p>Duration: ${(report.summary.totalDuration / 1000).toFixed(2)} seconds</p>
    </div>

    <div class="summary">
        <div class="stat-card passed">
            <h3>${report.summary.tests.passed}</h3>
            <p>Tests Passed</p>
        </div>
        <div class="stat-card failed">
            <h3>${report.summary.tests.failed}</h3>
            <p>Tests Failed</p>
        </div>
        <div class="stat-card skipped">
            <h3>${report.summary.tests.skipped}</h3>
            <p>Tests Skipped</p>
        </div>
        <div class="stat-card">
            <h3>${report.summary.suites.passed}/${report.summary.suites.total}</h3>
            <p>Suites Passed</p>
        </div>
    </div>

    <h2>Test Suite Results</h2>
    ${report.results.map((result: TestResult) => {
      const suite = this.testSuites.find(s => s.name === result.suite);
      return `
        <div class="test-suite ${result.status} ${suite?.critical ? 'critical' : ''}">
            <h3>${result.suite} ${suite?.critical ? '[CRITICAL]' : ''}</h3>
            <p><strong>Status:</strong> ${result.status.toUpperCase()}</p>
            <p><strong>Duration:</strong> ${result.duration}ms</p>
            ${result.details ? `
                <p><strong>Tests:</strong> ${result.details.passed}/${result.details.total} passed
                ${result.details.failed > 0 ? `, ${result.details.failed} failed` : ''}
                ${result.details.skipped > 0 ? `, ${result.details.skipped} skipped` : ''}</p>
            ` : ''}
            ${result.error ? `<pre>Error: ${result.error}</pre>` : ''}
        </div>
      `;
    }).join('')}

    <h2>Environment</h2>
    <pre>${JSON.stringify(report.environment, null, 2)}</pre>
</body>
</html>`;

    const htmlReportPath = path.join(this.testOutputDir, 'mcp-test-results.html');
    await writeFile(htmlReportPath, htmlContent);
    console.log(`📊 HTML report saved to: ${htmlReportPath}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MCP Integration Test Runner

Usage: npm run test:mcp [options]

Options:
  --help, -h          Show this help message
  --html              Generate HTML report
  --critical-only     Run only critical tests
  --suite <name>      Run specific test suite

Environment Variables:
  NODE_ENV            Set to 'test' for test mode
  MCP_ENABLED         Enable MCP functionality (default: true)
  LOG_CONSOLE         Enable console logging (default: false)
  LOG_MEMORY_KEEPER   Enable memory-keeper logging (default: true)
  GENERATE_HTML_REPORT Generate HTML report (default: false)

Examples:
  npm run test:mcp
  npm run test:mcp --html
  npm run test:mcp --critical-only
  npm run test:mcp --suite "MCP Memory-Keeper Integration"
    `);
    process.exit(0);
  }

  if (args.includes('--html')) {
    process.env.GENERATE_HTML_REPORT = 'true';
  }

  const runner = new MCPTestRunner();
  
  // Filter test suites based on arguments
  if (args.includes('--critical-only')) {
    runner['testSuites'] = runner['testSuites'].filter(suite => suite.critical);
    console.log('🎯 Running critical tests only');
  }

  const suiteIndex = args.indexOf('--suite');
  if (suiteIndex !== -1 && args[suiteIndex + 1]) {
    const suiteName = args[suiteIndex + 1];
    runner['testSuites'] = runner['testSuites'].filter(suite => 
      suite.name.toLowerCase().includes(suiteName.toLowerCase())
    );
    console.log(`🎯 Running test suite: ${suiteName}`);
  }

  await runner.run();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}