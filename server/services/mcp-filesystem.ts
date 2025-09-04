import { structuredLogger, LogCategory } from './structured-logger';

// MCP filesystem tools interface
// These will be called by the MCP client/server
interface MCPFilesystemTools {
  read_text_file: (params: { path: string; head?: number; tail?: number }) => Promise<{ content: string }>;
  read_multiple_files: (params: { paths: string[] }) => Promise<{ files: Array<{ path: string; content: string; error?: string }> }>;
  read_media_file: (params: { path: string }) => Promise<{ data: string; mimeType: string }>;
  write_file: (params: { path: string; content: string }) => Promise<{ success: boolean }>;
  edit_file: (params: { path: string; edits: Array<{ oldText: string; newText: string }> }) => Promise<{ success: boolean; diff?: string }>;
  create_directory: (params: { path: string }) => Promise<{ success: boolean }>;
  list_directory: (params: { path: string }) => Promise<{ files: Array<{ name: string; type: 'file' | 'directory' }> }>;
  list_directory_with_sizes: (params: { path: string; sortBy?: 'name' | 'size' }) => Promise<{ files: Array<{ name: string; type: 'file' | 'directory'; size?: number }> }>;
  directory_tree: (params: { path: string }) => Promise<{ tree: any }>;
  move_file: (params: { source: string; destination: string }) => Promise<{ success: boolean }>;
  search_files: (params: { path: string; pattern: string; excludePatterns?: string[] }) => Promise<{ files: string[] }>;
  get_file_info: (params: { path: string }) => Promise<{ 
    name: string; 
    size: number; 
    type: 'file' | 'directory'; 
    created: string; 
    modified: string; 
    permissions: string;
  }>;
  list_allowed_directories: () => Promise<{ directories: string[] }>;
}

/**
 * MCP Filesystem Service Wrapper
 * Provides a unified interface to filesystem operations using MCP tools
 * with proper error handling, logging, and fallback to native fs operations
 */
export class MCPFilesystemService {
  private mcpTools: MCPFilesystemTools | null = null;
  private useFallback: boolean = true;

  constructor(mcpTools?: MCPFilesystemTools) {
    this.mcpTools = mcpTools || null;
    this.useFallback = !mcpTools;

    if (!this.mcpTools) {
      console.warn('[MCPFilesystem] No MCP tools provided, using fallback implementations');
    }
  }

  /**
   * Initialize MCP tools
   */
  public initializeMCPTools(mcpTools: MCPFilesystemTools): void {
    this.mcpTools = mcpTools;
    this.useFallback = false;
    
    structuredLogger.info(
      'MCP Filesystem Service initialized with MCP tools',
      LogCategory.SYSTEM_STARTUP,
      {
        metadata: {
          mcpEnabled: true,
          fallbackEnabled: false,
          operation: 'mcp_filesystem_init'
        }
      },
      ['mcp', 'filesystem', 'init']
    );
  }

  /**
   * Read a text file
   */
  public async readTextFile(filePath: string, options?: { head?: number; tail?: number }): Promise<string> {
    try {
      if (this.mcpTools && !this.useFallback) {
        const result = await this.mcpTools.read_text_file({ 
          path: filePath, 
          head: options?.head,
          tail: options?.tail 
        });
        
        await structuredLogger.info(
          `File read successfully via MCP: ${filePath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              filePath,
              method: 'mcp',
              operation: 'read_text_file',
              hasHead: !!options?.head,
              hasTail: !!options?.tail
            }
          },
          ['mcp', 'filesystem', 'read']
        );
        
        return result.content;
      } else {
        // Fallback to native fs
        const fs = await import('fs/promises');
        const content = await fs.readFile(filePath, 'utf-8');
        
        await structuredLogger.info(
          `File read successfully via fallback: ${filePath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              filePath,
              method: 'fallback',
              operation: 'read_text_file'
            }
          },
          ['filesystem', 'fallback', 'read']
        );
        
        // Apply head/tail options if specified
        if (options?.head || options?.tail) {
          const lines = content.split('\n');
          if (options.head) {
            return lines.slice(0, options.head).join('\n');
          } else if (options.tail) {
            return lines.slice(-options.tail).join('\n');
          }
        }
        
        return content;
      }
    } catch (error) {
      // If MCP fails, try fallback for critical operations
      if (this.mcpTools && !this.useFallback) {
        try {
          const fs = await import('fs/promises');
          const content = await fs.readFile(filePath, 'utf-8');
          
          await structuredLogger.info(
            `File read successfully via fallback after MCP failure: ${filePath}`,
            LogCategory.FILE_MANAGEMENT,
            {
              metadata: {
                filePath,
                method: 'fallback_after_mcp_failure',
                operation: 'read_text_file'
              }
            },
            ['filesystem', 'fallback', 'read']
          );
          
          // Apply head/tail options if specified
          if (options?.head || options?.tail) {
            const lines = content.split('\n');
            if (options.head) {
              return lines.slice(0, options.head).join('\n');
            } else if (options.tail) {
              return lines.slice(-options.tail).join('\n');
            }
          }
          
          return content;
        } catch (fallbackError) {
          await structuredLogger.error(
            `Failed to read file with both MCP and fallback: ${filePath}`,
            LogCategory.FILE_MANAGEMENT,
            fallbackError as Error,
            {
              metadata: {
                filePath,
                method: 'both_failed',
                operation: 'read_text_file',
                originalError: (error as Error).message
              }
            },
            ['filesystem', 'error', 'read']
          );
          throw fallbackError;
        }
      }
      
      await structuredLogger.error(
        `Failed to read file: ${filePath}`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            filePath,
            method: this.mcpTools ? 'mcp' : 'fallback',
            operation: 'read_text_file'
          }
        },
        ['filesystem', 'error', 'read']
      );
      throw error;
    }
  }

  /**
   * Read multiple files
   */
  public async readMultipleFiles(filePaths: string[]): Promise<Array<{ path: string; content: string; error?: string }>> {
    try {
      if (this.mcpTools && !this.useFallback) {
        const result = await this.mcpTools.read_multiple_files({ paths: filePaths });
        
        await structuredLogger.info(
          `Multiple files read successfully via MCP: ${filePaths.length} files`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              fileCount: filePaths.length,
              method: 'mcp',
              operation: 'read_multiple_files'
            }
          },
          ['mcp', 'filesystem', 'read']
        );
        
        return result.files;
      } else {
        // Fallback to native fs
        const fs = await import('fs/promises');
        const results: Array<{ path: string; content: string; error?: string }> = [];
        
        for (const filePath of filePaths) {
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            results.push({ path: filePath, content });
          } catch (error) {
            results.push({ 
              path: filePath, 
              content: '',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        await structuredLogger.info(
          `Multiple files read successfully via fallback: ${filePaths.length} files`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              fileCount: filePaths.length,
              method: 'fallback',
              operation: 'read_multiple_files'
            }
          },
          ['filesystem', 'fallback', 'read']
        );
        
        return results;
      }
    } catch (error) {
      await structuredLogger.error(
        `Failed to read multiple files: ${filePaths.length} files`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            fileCount: filePaths.length,
            method: this.mcpTools ? 'mcp' : 'fallback',
            operation: 'read_multiple_files'
          }
        },
        ['filesystem', 'error', 'read']
      );
      throw error;
    }
  }

  /**
   * Write a file
   */
  public async writeFile(filePath: string, content: string): Promise<void> {
    try {
      if (this.mcpTools && !this.useFallback) {
        await this.mcpTools.write_file({ path: filePath, content });
        
        await structuredLogger.info(
          `File written successfully via MCP: ${filePath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              filePath,
              contentLength: content.length,
              method: 'mcp',
              operation: 'write_file'
            }
          },
          ['mcp', 'filesystem', 'write']
        );
      } else {
        // Fallback to native fs
        const fs = await import('fs/promises');
        await fs.writeFile(filePath, content, 'utf-8');
        
        await structuredLogger.info(
          `File written successfully via fallback: ${filePath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              filePath,
              contentLength: content.length,
              method: 'fallback',
              operation: 'write_file'
            }
          },
          ['filesystem', 'fallback', 'write']
        );
      }
    } catch (error) {
      await structuredLogger.error(
        `Failed to write file: ${filePath}`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            filePath,
            contentLength: content.length,
            method: this.mcpTools ? 'mcp' : 'fallback',
            operation: 'write_file'
          }
        },
        ['filesystem', 'error', 'write']
      );
      throw error;
    }
  }

  /**
   * Create directory
   */
  public async createDirectory(dirPath: string): Promise<void> {
    try {
      if (this.mcpTools && !this.useFallback) {
        await this.mcpTools.create_directory({ path: dirPath });
        
        await structuredLogger.info(
          `Directory created successfully via MCP: ${dirPath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              dirPath,
              method: 'mcp',
              operation: 'create_directory'
            }
          },
          ['mcp', 'filesystem', 'mkdir']
        );
      } else {
        // Fallback to native fs
        const fs = await import('fs/promises');
        await fs.mkdir(dirPath, { recursive: true });
        
        await structuredLogger.info(
          `Directory created successfully via fallback: ${dirPath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              dirPath,
              method: 'fallback',
              operation: 'create_directory'
            }
          },
          ['filesystem', 'fallback', 'mkdir']
        );
      }
    } catch (error) {
      await structuredLogger.error(
        `Failed to create directory: ${dirPath}`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            dirPath,
            method: this.mcpTools ? 'mcp' : 'fallback',
            operation: 'create_directory'
          }
        },
        ['filesystem', 'error', 'mkdir']
      );
      throw error;
    }
  }

  /**
   * List directory contents
   */
  public async listDirectory(dirPath: string, includeSize: boolean = false): Promise<Array<{ name: string; type: 'file' | 'directory'; size?: number }>> {
    try {
      if (this.mcpTools && !this.useFallback) {
        const result = includeSize
          ? await this.mcpTools.list_directory_with_sizes({ path: dirPath })
          : await this.mcpTools.list_directory({ path: dirPath });
        
        await structuredLogger.info(
          `Directory listed successfully via MCP: ${dirPath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              dirPath,
              itemCount: result.files.length,
              includeSize,
              method: 'mcp',
              operation: 'list_directory'
            }
          },
          ['mcp', 'filesystem', 'list']
        );
        
        return result.files;
      } else {
        // Fallback to native fs
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const files: Array<{ name: string; type: 'file' | 'directory'; size?: number }> = [];
        
        for (const entry of entries) {
          const item = {
            name: entry.name,
            type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          };
          
          if (includeSize && entry.isFile()) {
            try {
              const stats = await fs.stat(path.join(dirPath, entry.name));
              (item as any).size = stats.size;
            } catch {
              // Ignore stat errors
            }
          }
          
          files.push(item);
        }
        
        await structuredLogger.info(
          `Directory listed successfully via fallback: ${dirPath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              dirPath,
              itemCount: files.length,
              includeSize,
              method: 'fallback',
              operation: 'list_directory'
            }
          },
          ['filesystem', 'fallback', 'list']
        );
        
        return files;
      }
    } catch (error) {
      await structuredLogger.error(
        `Failed to list directory: ${dirPath}`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            dirPath,
            method: this.mcpTools ? 'mcp' : 'fallback',
            operation: 'list_directory'
          }
        },
        ['filesystem', 'error', 'list']
      );
      throw error;
    }
  }

  /**
   * Check if file/directory exists
   */
  public async exists(filePath: string): Promise<boolean> {
    try {
      if (this.mcpTools && !this.useFallback) {
        try {
          await this.mcpTools.get_file_info({ path: filePath });
          return true;
        } catch {
          return false;
        }
      } else {
        // Fallback to native fs
        const fs = await import('fs/promises');
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      }
    } catch (error) {
      await structuredLogger.error(
        `Failed to check file existence: ${filePath}`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            filePath,
            method: this.mcpTools ? 'mcp' : 'fallback',
            operation: 'exists'
          }
        },
        ['filesystem', 'error', 'exists']
      );
      return false;
    }
  }

  /**
   * Delete file
   */
  public async deleteFile(filePath: string): Promise<void> {
    try {
      // Note: MCP filesystem doesn't have a delete operation, so we always use native fs
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
      
      await structuredLogger.info(
        `File deleted successfully: ${filePath}`,
        LogCategory.FILE_MANAGEMENT,
        {
          metadata: {
            filePath,
            method: 'native',
            operation: 'delete_file'
          }
        },
        ['filesystem', 'delete']
      );
    } catch (error) {
      await structuredLogger.error(
        `Failed to delete file: ${filePath}`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            filePath,
            method: 'native',
            operation: 'delete_file'
          }
        },
        ['filesystem', 'error', 'delete']
      );
      throw error;
    }
  }

  /**
   * Get file information
   */
  public async getFileInfo(filePath: string): Promise<{
    name: string;
    size: number;
    type: 'file' | 'directory';
    created: string;
    modified: string;
    permissions?: string;
  }> {
    try {
      if (this.mcpTools && !this.useFallback) {
        const result = await this.mcpTools.get_file_info({ path: filePath });
        
        await structuredLogger.info(
          `File info retrieved successfully via MCP: ${filePath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              filePath,
              fileSize: result.size,
              fileType: result.type,
              method: 'mcp',
              operation: 'get_file_info'
            }
          },
          ['mcp', 'filesystem', 'info']
        );
        
        return result;
      } else {
        // Fallback to native fs
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const stats = await fs.stat(filePath);
        const result = {
          name: path.basename(filePath),
          size: stats.size,
          type: stats.isDirectory() ? 'directory' as const : 'file' as const,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          permissions: stats.mode.toString(8)
        };
        
        await structuredLogger.info(
          `File info retrieved successfully via fallback: ${filePath}`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              filePath,
              fileSize: result.size,
              fileType: result.type,
              method: 'fallback',
              operation: 'get_file_info'
            }
          },
          ['filesystem', 'fallback', 'info']
        );
        
        return result;
      }
    } catch (error) {
      await structuredLogger.error(
        `Failed to get file info: ${filePath}`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            filePath,
            method: this.mcpTools ? 'mcp' : 'fallback',
            operation: 'get_file_info'
          }
        },
        ['filesystem', 'error', 'info']
      );
      throw error;
    }
  }

  /**
   * Calculate file hash
   */
  public async calculateFileHash(filePath: string): Promise<string> {
    try {
      // Always use native crypto for hash calculation
      const fs = await import('fs/promises');
      const crypto = await import('crypto');
      
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      await structuredLogger.info(
        `File hash calculated: ${filePath}`,
        LogCategory.FILE_MANAGEMENT,
        {
          metadata: {
            filePath,
            hash,
            operation: 'calculate_hash'
          }
        },
        ['filesystem', 'hash']
      );
      
      return hash;
    } catch (error) {
      await structuredLogger.error(
        `Failed to calculate file hash: ${filePath}`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            filePath,
            operation: 'calculate_hash'
          }
        },
        ['filesystem', 'error', 'hash']
      );
      throw error;
    }
  }

  /**
   * Search files
   */
  public async searchFiles(basePath: string, pattern: string, excludePatterns?: string[]): Promise<string[]> {
    try {
      if (this.mcpTools && !this.useFallback) {
        const result = await this.mcpTools.search_files({ 
          path: basePath, 
          pattern, 
          excludePatterns 
        });
        
        await structuredLogger.info(
          `File search completed via MCP: ${result.files.length} files found`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              basePath,
              pattern,
              resultCount: result.files.length,
              method: 'mcp',
              operation: 'search_files'
            }
          },
          ['mcp', 'filesystem', 'search']
        );
        
        return result.files;
      } else {
        // Fallback to simple native fs search
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const results: string[] = [];
        
        async function searchRecursive(dir: string): Promise<void> {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
              await searchRecursive(fullPath);
            } else if (entry.isFile() && entry.name.includes(pattern)) {
              // Simple pattern matching
              if (!excludePatterns || !excludePatterns.some(exclude => fullPath.includes(exclude))) {
                results.push(fullPath);
              }
            }
          }
        }
        
        await searchRecursive(basePath);
        
        await structuredLogger.info(
          `File search completed via fallback: ${results.length} files found`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              basePath,
              pattern,
              resultCount: results.length,
              method: 'fallback',
              operation: 'search_files'
            }
          },
          ['filesystem', 'fallback', 'search']
        );
        
        return results;
      }
    } catch (error) {
      await structuredLogger.error(
        `Failed to search files: ${basePath}`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            basePath,
            pattern,
            method: this.mcpTools ? 'mcp' : 'fallback',
            operation: 'search_files'
          }
        },
        ['filesystem', 'error', 'search']
      );
      throw error;
    }
  }

  /**
   * Get allowed directories (MCP only)
   */
  public async getAllowedDirectories(): Promise<string[]> {
    try {
      if (this.mcpTools && !this.useFallback) {
        const result = await this.mcpTools.list_allowed_directories();
        
        await structuredLogger.info(
          `Allowed directories retrieved via MCP: ${result.directories.length} directories`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              directoryCount: result.directories.length,
              method: 'mcp',
              operation: 'list_allowed_directories'
            }
          },
          ['mcp', 'filesystem', 'allowed']
        );
        
        return result.directories;
      } else {
        // Fallback: return current working directory
        const cwd = process.cwd();
        
        await structuredLogger.info(
          `Allowed directories fallback: current working directory`,
          LogCategory.FILE_MANAGEMENT,
          {
            metadata: {
              directory: cwd,
              method: 'fallback',
              operation: 'list_allowed_directories'
            }
          },
          ['filesystem', 'fallback', 'allowed']
        );
        
        return [cwd];
      }
    } catch (error) {
      await structuredLogger.error(
        `Failed to get allowed directories`,
        LogCategory.FILE_MANAGEMENT,
        error as Error,
        {
          metadata: {
            method: this.mcpTools ? 'mcp' : 'fallback',
            operation: 'list_allowed_directories'
          }
        },
        ['filesystem', 'error', 'allowed']
      );
      throw error;
    }
  }

  /**
   * Check if MCP tools are available
   */
  public isMCPEnabled(): boolean {
    return !!(this.mcpTools && !this.useFallback);
  }

  /**
   * Enable/disable fallback mode
   */
  public setFallbackMode(enabled: boolean): void {
    this.useFallback = enabled;
    
    structuredLogger.info(
      `MCP Filesystem fallback mode ${enabled ? 'enabled' : 'disabled'}`,
      LogCategory.SYSTEM_CONFIG,
      {
        metadata: {
          fallbackEnabled: enabled,
          mcpEnabled: !!this.mcpTools,
          operation: 'set_fallback_mode'
        }
      },
      ['mcp', 'filesystem', 'config']
    );
  }
}

// Create and export singleton instance
export const mcpFilesystem = new MCPFilesystemService();