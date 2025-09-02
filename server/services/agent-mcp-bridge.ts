import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Bridge service to give agents access to MCP-like capabilities
 * Agents can request operations that this service executes using actual MCP tools
 */
export class AgentMCPBridge {
  private memoryContext: Map<string, any> = new Map();
  
  /**
   * Execute filesystem operations for agents
   */
  async fileOperation(operation: string, params: any): Promise<any> {
    switch (operation) {
      case 'read':
        return await fs.readFile(params.path, 'utf-8');
      
      case 'write':
        await fs.writeFile(params.path, params.content);
        return { success: true, path: params.path };
      
      case 'list': {
        const files = await fs.readdir(params.path);
        return files;
      }
      
      case 'exists':
        try {
          await fs.access(params.path);
          return true;
        } catch {
          return false;
        }
      
      default:
        throw new Error(`Unknown file operation: ${operation}`);
    }
  }

  /**
   * Execute git operations for agents
   */
  async gitOperation(operation: string, params: any): Promise<any> {
    const cwd = params.repo || process.cwd();
    
    switch (operation) {
      case 'status': {
        const { stdout: status } = await execAsync('git status --short', { cwd });
        return status;
      }
      
      case 'diff': {
        const { stdout: diff } = await execAsync('git diff', { cwd });
        return diff;
      }
      
      case 'log': {
        const { stdout: log } = await execAsync('git log --oneline -10', { cwd });
        return log;
      }
      
      case 'branch': {
        const { stdout: branches } = await execAsync('git branch -a', { cwd });
        return branches;
      }
      
      default:
        throw new Error(`Unknown git operation: ${operation}`);
    }
  }

  /**
   * Memory keeper operations for agents
   */
  async memoryOperation(operation: string, params: any): Promise<any> {
    switch (operation) {
      case 'save':
        this.memoryContext.set(params.key, {
          value: params.value,
          timestamp: new Date().toISOString(),
          category: params.category || 'general'
        });
        return { success: true, key: params.key };
      
      case 'get': {
        const item = this.memoryContext.get(params.key);
        return item || null;
      }
      
      case 'search': {
        const results: any[] = [];
        this.memoryContext.forEach((value, key) => {
          if (key.includes(params.query) || 
              JSON.stringify(value).includes(params.query)) {
            results.push({ key, ...value });
          }
        });
        return results;
      }
      
      case 'list': {
        const items: any[] = [];
        this.memoryContext.forEach((value, key) => {
          items.push({ key, ...value });
        });
        return items;
      }
      
      default:
        throw new Error(`Unknown memory operation: ${operation}`);
    }
  }

  /**
   * Web search operation for agents
   */
  async webSearch(query: string): Promise<any> {
    // Simulate web search - in production, this would call actual search API
    return {
      query,
      results: [
        {
          title: "UK GDPR Guidance",
          url: "https://ico.org.uk/gdpr",
          snippet: "The UK GDPR sets out seven key principles..."
        },
        {
          title: "Data Protection Act 2018",
          url: "https://legislation.gov.uk/dpa2018",
          snippet: "An Act to make provision for the regulation..."
        }
      ],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Database operations for agents
   */
  async databaseOperation(operation: string, params: any): Promise<any> {
    // This would connect to actual database
    // For now, return mock data for safety
    switch (operation) {
      case 'query':
        return {
          rows: [],
          rowCount: 0,
          query: params.sql
        };
      
      case 'schema':
        return {
          tables: ['cases', 'documents', 'persons', 'events'],
          timestamp: new Date().toISOString()
        };
      
      default:
        throw new Error(`Unknown database operation: ${operation}`);
    }
  }

  /**
   * Process tool request from agent
   */
  async processAgentToolRequest(request: {
    tool: string;
    operation: string;
    params: any;
  }): Promise<any> {
    try {
      switch (request.tool) {
        case 'filesystem':
          return await this.fileOperation(request.operation, request.params);
        
        case 'git':
          return await this.gitOperation(request.operation, request.params);
        
        case 'memory':
          return await this.memoryOperation(request.operation, request.params);
        
        case 'web':
          return await this.webSearch(request.params.query);
        
        case 'database':
          return await this.databaseOperation(request.operation, request.params);
        
        default:
          throw new Error(`Unknown tool: ${request.tool}`);
      }
    } catch (error: any) {
      return {
        error: true,
        message: error.message,
        tool: request.tool,
        operation: request.operation
      };
    }
  }

  /**
   * Enhanced agent prompt with tool usage instructions
   */
  getToolEnabledSystemPrompt(): string {
    return `You are an AI agent with access to various tools. You can request tool operations by outputting special commands in your response.

Available tools and operations:

1. FILESYSTEM:
   [FILE:READ:path] - Read file contents
   [FILE:WRITE:path:content] - Write to file
   [FILE:LIST:path] - List directory contents
   [FILE:EXISTS:path] - Check if file exists

2. GIT:
   [GIT:STATUS] - Get git status
   [GIT:DIFF] - Get git diff
   [GIT:LOG] - Get recent commits
   [GIT:BRANCH] - List branches

3. MEMORY:
   [MEM:SAVE:key:value] - Save to memory
   [MEM:GET:key] - Retrieve from memory
   [MEM:SEARCH:query] - Search memory
   [MEM:LIST] - List all memory items

4. WEB:
   [WEB:SEARCH:query] - Search the web

5. DATABASE:
   [DB:QUERY:sql] - Execute SQL query
   [DB:SCHEMA] - Get database schema

When you need to use a tool, include the command in square brackets as shown above.
The system will execute these commands and provide results.`;
  }

  /**
   * Parse agent response for tool commands and execute them
   */
  async parseAndExecuteTools(agentResponse: string): Promise<{
    response: string;
    toolResults: any[];
  }> {
    const toolPattern = /\[(FILE|GIT|MEM|WEB|DB):([^:\]]+)(?::([^:\]]+))?(?::([^\]]+))?\]/g;
    const toolResults: any[] = [];
    let enhancedResponse = agentResponse;

    const matches = Array.from(agentResponse.matchAll(toolPattern));
    
    for (const match of matches) {
      const [fullMatch, tool, operation, ...params] = match;
      
      let request: any = {
        tool: '',
        operation: operation.toLowerCase(),
        params: {}
      };

      switch (tool) {
        case 'FILE':
          request.tool = 'filesystem';
          request.params = params[0] ? { path: params[0] } : {};
          if (params[1]) request.params.content = params[1];
          break;
        
        case 'GIT':
          request.tool = 'git';
          request.params = { repo: process.cwd() };
          break;
        
        case 'MEM':
          request.tool = 'memory';
          request.params = params[0] ? { key: params[0] } : {};
          if (params[1]) request.params.value = params[1];
          if (operation === 'search') request.params.query = params[0];
          break;
        
        case 'WEB':
          request.tool = 'web';
          request.params = { query: params[0] || operation };
          request.operation = 'search';
          break;
        
        case 'DB':
          request.tool = 'database';
          request.params = { sql: params[0] || '' };
          break;
      }

      const result = await this.processAgentToolRequest(request);
      toolResults.push({
        command: fullMatch,
        result
      });

      // Replace command with result in response
      enhancedResponse = enhancedResponse.replace(
        fullMatch,
        `[Result: ${JSON.stringify(result).substring(0, 100)}...]`
      );
    }

    return {
      response: enhancedResponse,
      toolResults
    };
  }
}

// Export singleton instance
export const agentMCPBridge = new AgentMCPBridge();