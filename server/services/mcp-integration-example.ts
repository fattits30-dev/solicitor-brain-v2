/**
 * MCP Filesystem Integration Example
 *
 * This file demonstrates how the MCP filesystem integration works
 * across different services in the Solicitor Brain application.
 */

import { mcpFilesystem } from './mcp-filesystem';
import { LogCategory, structuredLogger } from './structured-logger';

/**
 * Example: Initialize MCP filesystem with actual MCP tools
 * This would be called during application startup when MCP tools are available
 */
export async function initializeMCPFilesystem() {
  // In a real implementation, these tools would come from the MCP client
  const _mockMCPTools = {
    async read_text_file(params: { path: string; head?: number; tail?: number }) {
      console.log(`[MCP] Reading file: ${params.path}`);
      // This would actually call the MCP filesystem tools
      throw new Error('MCP tools not actually available in this example');
    },

    async write_file(params: { path: string; content: string }) {
      console.log(`[MCP] Writing file: ${params.path}`);
      return { success: true };
    },

    async create_directory(params: { path: string }) {
      console.log(`[MCP] Creating directory: ${params.path}`);
      return { success: true };
    },

    async list_directory(params: { path: string }) {
      console.log(`[MCP] Listing directory: ${params.path}`);
      return { files: [] };
    },

    async list_directory_with_sizes(params: { path: string; sortBy?: 'name' | 'size' }) {
      console.log(`[MCP] Listing directory with sizes: ${params.path}`);
      return { files: [] };
    },

    async directory_tree(params: { path: string }) {
      console.log(`[MCP] Getting directory tree: ${params.path}`);
      return { tree: {} };
    },

    async move_file(params: { source: string; destination: string }) {
      console.log(`[MCP] Moving file: ${params.source} -> ${params.destination}`);
      return { success: true };
    },

    async search_files(params: { path: string; pattern: string; excludePatterns?: string[] }) {
      console.log(`[MCP] Searching files: ${params.pattern} in ${params.path}`);
      return { files: [] };
    },

    async get_file_info(params: { path: string }) {
      console.log(`[MCP] Getting file info: ${params.path}`);
      return {
        name: 'example.txt',
        size: 1024,
        type: 'file' as const,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        permissions: '644',
      };
    },

    async read_multiple_files(params: { paths: string[] }) {
      console.log(`[MCP] Reading multiple files: ${params.paths.length} files`);
      return {
        files: params.paths.map((path) => ({ path, content: '', error: 'Not implemented' })),
      };
    },

    async read_media_file(params: { path: string }) {
      console.log(`[MCP] Reading media file: ${params.path}`);
      return { data: '', mimeType: 'application/octet-stream' };
    },

    async list_allowed_directories() {
      console.log('[MCP] Getting allowed directories');
      return { directories: ['/home/user/documents', '/tmp'] };
    },

    async edit_file(params: { path: string; edits: Array<{ oldText: string; newText: string }> }) {
      console.log(`[MCP] Editing file: ${params.path} with ${params.edits.length} edits`);
      return { success: true };
    },
  };

  // Initialize the MCP filesystem service with tools
  // mcpFilesystem.initializeMCPTools(mockMCPTools);

  await structuredLogger.info(
    'MCP Filesystem integration example initialized',
    LogCategory.SYSTEM_STARTUP,
    {
      metadata: {
        mcpEnabled: mcpFilesystem.isMCPEnabled(),
        operation: 'mcp_integration_example_init',
      },
    },
    ['mcp', 'filesystem', 'example'],
  );
}

/**
 * Example: Document upload process with MCP filesystem
 */
export async function demonstrateDocumentUpload(filePath: string, content: string) {
  try {
    await structuredLogger.info(
      'Starting document upload demonstration',
      LogCategory.DOCUMENT_UPLOAD,
      {
        metadata: {
          filePath,
          contentLength: content.length,
          operation: 'demo_document_upload',
        },
      },
      ['demo', 'document', 'upload'],
    );

    // Write file using MCP filesystem
    await mcpFilesystem.writeFile(filePath, content);

    // Verify file exists
    const exists = await mcpFilesystem.exists(filePath);
    if (!exists) {
      throw new Error('File was not created successfully');
    }

    // Get file information
    const fileInfo = await mcpFilesystem.getFileInfo(filePath);

    // Calculate file hash for deduplication
    const hash = await mcpFilesystem.calculateFileHash(filePath);

    // Read file back to verify
    const readContent = await mcpFilesystem.readTextFile(filePath);

    await structuredLogger.info(
      'Document upload demonstration completed successfully',
      LogCategory.DOCUMENT_UPLOAD,
      {
        metadata: {
          filePath,
          fileSize: fileInfo.size,
          hash,
          contentMatches: readContent === content,
          mcpEnabled: mcpFilesystem.isMCPEnabled(),
          operation: 'demo_document_upload_complete',
        },
      },
      ['demo', 'document', 'upload', 'success'],
    );

    return {
      filePath,
      fileInfo,
      hash,
      contentMatches: readContent === content,
      mcpEnabled: mcpFilesystem.isMCPEnabled(),
    };
  } catch (error) {
    await structuredLogger.error(
      'Document upload demonstration failed',
      LogCategory.DOCUMENT_UPLOAD,
      error as Error,
      {
        metadata: {
          filePath,
          operation: 'demo_document_upload',
        },
      },
      ['demo', 'document', 'upload', 'error'],
    );
    throw error;
  }
}

/**
 * Example: Directory operations with MCP filesystem
 */
export async function demonstrateDirectoryOperations(basePath: string) {
  try {
    await structuredLogger.info(
      'Starting directory operations demonstration',
      LogCategory.FILE_MANAGEMENT,
      {
        metadata: {
          basePath,
          operation: 'demo_directory_operations',
        },
      },
      ['demo', 'directory', 'operations'],
    );

    // Create a directory
    const testDir = `${basePath}/mcp-demo-dir`;
    await mcpFilesystem.createDirectory(testDir);

    // Create some test files
    await mcpFilesystem.writeFile(`${testDir}/file1.txt`, 'Content of file 1');
    await mcpFilesystem.writeFile(`${testDir}/file2.txt`, 'Content of file 2');

    // Create subdirectory
    const subDir = `${testDir}/subdir`;
    await mcpFilesystem.createDirectory(subDir);
    await mcpFilesystem.writeFile(`${subDir}/nested.txt`, 'Nested file content');

    // List directory contents
    const contents = await mcpFilesystem.listDirectory(testDir, true);

    // Search for files
    const txtFiles = await mcpFilesystem.searchFiles(testDir, '.txt');

    // Read multiple files
    const filesToRead = [`${testDir}/file1.txt`, `${testDir}/file2.txt`, `${subDir}/nested.txt`];
    const fileContents = await mcpFilesystem.readMultipleFiles(filesToRead);

    // Clean up
    await mcpFilesystem.deleteFile(`${testDir}/file1.txt`);
    await mcpFilesystem.deleteFile(`${testDir}/file2.txt`);
    await mcpFilesystem.deleteFile(`${subDir}/nested.txt`);

    await structuredLogger.info(
      'Directory operations demonstration completed',
      LogCategory.FILE_MANAGEMENT,
      {
        metadata: {
          basePath,
          filesFound: contents.length,
          txtFilesFound: txtFiles.length,
          filesRead: fileContents.filter((f) => !f.error).length,
          mcpEnabled: mcpFilesystem.isMCPEnabled(),
          operation: 'demo_directory_operations_complete',
        },
      },
      ['demo', 'directory', 'operations', 'success'],
    );

    return {
      directoryContents: contents,
      txtFiles,
      fileContents,
      mcpEnabled: mcpFilesystem.isMCPEnabled(),
    };
  } catch (error) {
    await structuredLogger.error(
      'Directory operations demonstration failed',
      LogCategory.FILE_MANAGEMENT,
      error as Error,
      {
        metadata: {
          basePath,
          operation: 'demo_directory_operations',
        },
      },
      ['demo', 'directory', 'operations', 'error'],
    );
    throw error;
  }
}

/**
 * Example: MCP filesystem service status and capabilities
 */
export async function getMCPFilesystemStatus() {
  const status = {
    mcpEnabled: mcpFilesystem.isMCPEnabled(),
    fallbackMode: !mcpFilesystem.isMCPEnabled(),
    allowedDirectories: await mcpFilesystem
      .getAllowedDirectories()
      .catch(() => ['Unable to retrieve']),
    capabilities: {
      readTextFile: true,
      writeFile: true,
      createDirectory: true,
      listDirectory: true,
      fileInfo: true,
      calculateHash: true,
      deleteFile: true,
      searchFiles: true,
      readMultipleFiles: true,
      headTailSupport: true,
    },
    timestamp: new Date().toISOString(),
  };

  await structuredLogger.info(
    'MCP Filesystem status retrieved',
    LogCategory.SYSTEM_STATUS,
    {
      metadata: {
        ...status,
        operation: 'mcp_filesystem_status',
      },
    },
    ['mcp', 'filesystem', 'status'],
  );

  return status;
}

/**
 * Example: Integration with other services
 */
export class MCPIntegratedService {
  constructor(private serviceName: string) {}

  async processFile(filePath: string, operation: string) {
    await structuredLogger.info(
      `${this.serviceName} processing file with MCP integration`,
      LogCategory.FILE_MANAGEMENT,
      {
        metadata: {
          serviceName: this.serviceName,
          filePath,
          operation,
          mcpEnabled: mcpFilesystem.isMCPEnabled(),
        },
      },
      ['service', 'mcp', 'integration'],
    );

    // Use MCP filesystem for file operations
    const exists = await mcpFilesystem.exists(filePath);
    if (!exists) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const content = await mcpFilesystem.readTextFile(filePath);
    const fileInfo = await mcpFilesystem.getFileInfo(filePath);

    // Process the file based on operation
    let result;
    switch (operation) {
      case 'analyze':
        result = `Analysis of ${fileInfo.name}: ${content.length} characters, created ${fileInfo.created}`;
        break;
      case 'backup': {
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await mcpFilesystem.writeFile(backupPath, content);
        result = `Backup created: ${backupPath}`;
        break;
      }
      case 'summary':
        result = `File: ${fileInfo.name}, Size: ${fileInfo.size} bytes, Type: ${fileInfo.type}`;
        break;
      default:
        result = `Unknown operation: ${operation}`;
    }

    await structuredLogger.info(
      `${this.serviceName} file processing completed`,
      LogCategory.FILE_MANAGEMENT,
      {
        metadata: {
          serviceName: this.serviceName,
          filePath,
          operation,
          result,
          mcpEnabled: mcpFilesystem.isMCPEnabled(),
        },
      },
      ['service', 'mcp', 'integration', 'success'],
    );

    return result;
  }
}

// Example usage:
// const uploadService = new MCPIntegratedService('UploadService');
// const ocrService = new MCPIntegratedService('OCRService');
// const fileWatcherService = new MCPIntegratedService('FileWatcherService');
