import { MCPFilesystemService } from '../mcp-filesystem';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('MCPFilesystemService', () => {
  let mcpFs: MCPFilesystemService;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    mcpFs = new MCPFilesystemService();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-fs-test-'));
    testFile = path.join(testDir, 'test.txt');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Fallback Mode (no MCP tools)', () => {
    test('should write and read text files using fallback', async () => {
      const testContent = 'Hello, MCP Filesystem!';

      // Write file
      await mcpFs.writeFile(testFile, testContent);

      // Verify file exists
      const exists = await mcpFs.exists(testFile);
      expect(exists).toBe(true);

      // Read file back
      const content = await mcpFs.readTextFile(testFile);
      expect(content).toBe(testContent);
    });

    test('should create directories using fallback', async () => {
      const subDir = path.join(testDir, 'subdir', 'nested');

      await mcpFs.createDirectory(subDir);

      const exists = await mcpFs.exists(subDir);
      expect(exists).toBe(true);
    });

    test('should list directory contents using fallback', async () => {
      // Create some test files
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir'));

      const contents = await mcpFs.listDirectory(testDir);

      expect(contents).toHaveLength(3);
      
      const fileNames = contents.map(item => item.name).sort();
      expect(fileNames).toEqual(['file1.txt', 'file2.txt', 'subdir']);

      const fileTypes = contents.reduce((acc, item) => {
        acc[item.name] = item.type;
        return acc;
      }, {} as Record<string, string>);

      expect(fileTypes['file1.txt']).toBe('file');
      expect(fileTypes['file2.txt']).toBe('file');
      expect(fileTypes['subdir']).toBe('directory');
    });

    test('should get file information using fallback', async () => {
      const testContent = 'Test file content';
      await fs.writeFile(testFile, testContent);

      const info = await mcpFs.getFileInfo(testFile);

      expect(info.name).toBe('test.txt');
      expect(info.size).toBe(testContent.length);
      expect(info.type).toBe('file');
      expect(info.created).toBeDefined();
      expect(info.modified).toBeDefined();
    });

    test('should calculate file hash correctly', async () => {
      const testContent = 'Test content for hashing';
      await fs.writeFile(testFile, testContent);

      const hash = await mcpFs.calculateFileHash(testFile);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex string
    });

    test('should delete files correctly', async () => {
      await fs.writeFile(testFile, 'test content');

      // Verify file exists
      expect(await mcpFs.exists(testFile)).toBe(true);

      // Delete file
      await mcpFs.deleteFile(testFile);

      // Verify file is deleted
      expect(await mcpFs.exists(testFile)).toBe(false);
    });

    test('should read multiple files', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      const file3 = path.join(testDir, 'nonexistent.txt');

      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');

      const results = await mcpFs.readMultipleFiles([file1, file2, file3]);

      expect(results).toHaveLength(3);

      // Check successful reads
      const result1 = results.find(r => r.path === file1);
      const result2 = results.find(r => r.path === file2);
      const result3 = results.find(r => r.path === file3);

      expect(result1?.content).toBe('content1');
      expect(result1?.error).toBeUndefined();

      expect(result2?.content).toBe('content2');
      expect(result2?.error).toBeUndefined();

      expect(result3?.content).toBe('');
      expect(result3?.error).toBeDefined();
    });

    test('should search files with pattern matching', async () => {
      // Create test files
      await fs.writeFile(path.join(testDir, 'test1.js'), 'console.log("test1");');
      await fs.writeFile(path.join(testDir, 'test2.ts'), 'console.log("test2");');
      await fs.writeFile(path.join(testDir, 'readme.txt'), 'readme content');
      await fs.mkdir(path.join(testDir, 'subdir'));
      await fs.writeFile(path.join(testDir, 'subdir', 'nested.js'), 'console.log("nested");');

      const results = await mcpFs.searchFiles(testDir, '.js');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(file => file.includes('test1.js'))).toBe(true);
      expect(results.some(file => file.includes('nested.js'))).toBe(true);
    });

    test('should handle file reading with head and tail options', async () => {
      const lines = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'];
      const testContent = lines.join('\n');
      await fs.writeFile(testFile, testContent);

      // Test head option
      const headResult = await mcpFs.readTextFile(testFile, { head: 3 });
      expect(headResult).toBe('line 1\nline 2\nline 3');

      // Test tail option
      const tailResult = await mcpFs.readTextFile(testFile, { tail: 2 });
      expect(tailResult).toBe('line 4\nline 5');
    });

    test('should report MCP status correctly', () => {
      expect(mcpFs.isMCPEnabled()).toBe(false);
    });

    test('should get allowed directories (fallback returns cwd)', async () => {
      const dirs = await mcpFs.getAllowedDirectories();
      
      expect(Array.isArray(dirs)).toBe(true);
      expect(dirs.length).toBeGreaterThan(0);
      expect(dirs[0]).toBe(process.cwd());
    });
  });

  describe('MCP Tools Mode', () => {
    let mockMCPTools: any;

    beforeEach(() => {
      mockMCPTools = {
        read_text_file: jest.fn(),
        write_file: jest.fn(),
        create_directory: jest.fn(),
        list_directory: jest.fn(),
        get_file_info: jest.fn(),
        read_multiple_files: jest.fn(),
        search_files: jest.fn(),
        list_allowed_directories: jest.fn(),
      };

      mcpFs.initializeMCPTools(mockMCPTools);
    });

    test('should use MCP tools when available', async () => {
      mockMCPTools.read_text_file.mockResolvedValue({ content: 'mcp content' });

      const result = await mcpFs.readTextFile('/test/path.txt');

      expect(result).toBe('mcp content');
      expect(mockMCPTools.read_text_file).toHaveBeenCalledWith({
        path: '/test/path.txt',
        head: undefined,
        tail: undefined
      });
    });

    test('should report MCP status correctly when tools are available', () => {
      expect(mcpFs.isMCPEnabled()).toBe(true);
    });

    test('should use MCP tools for writing files', async () => {
      mockMCPTools.write_file.mockResolvedValue({ success: true });

      await mcpFs.writeFile('/test/path.txt', 'test content');

      expect(mockMCPTools.write_file).toHaveBeenCalledWith({
        path: '/test/path.txt',
        content: 'test content'
      });
    });

    test('should use MCP tools for directory operations', async () => {
      mockMCPTools.create_directory.mockResolvedValue({ success: true });
      mockMCPTools.list_directory.mockResolvedValue({
        files: [
          { name: 'file1.txt', type: 'file' },
          { name: 'subdir', type: 'directory' }
        ]
      });

      await mcpFs.createDirectory('/test/newdir');
      const contents = await mcpFs.listDirectory('/test/dir');

      expect(mockMCPTools.create_directory).toHaveBeenCalledWith({
        path: '/test/newdir'
      });

      expect(mockMCPTools.list_directory).toHaveBeenCalledWith({
        path: '/test/dir'
      });

      expect(contents).toEqual([
        { name: 'file1.txt', type: 'file' },
        { name: 'subdir', type: 'directory' }
      ]);
    });

    test('should fallback to native fs when MCP tools fail', async () => {
      mockMCPTools.read_text_file.mockRejectedValue(new Error('MCP failed'));

      // Create actual test file for fallback
      await fs.writeFile(testFile, 'fallback content');

      const result = await mcpFs.readTextFile(testFile);

      expect(result).toBe('fallback content');
      expect(mockMCPTools.read_text_file).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should throw error for non-existent file', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');

      await expect(mcpFs.readTextFile(nonExistentFile)).rejects.toThrow();
    });

    test('should handle permission errors gracefully', async () => {
      // This test might be platform-dependent
      const restrictedPath = '/root/restricted-file.txt';

      await expect(mcpFs.readTextFile(restrictedPath)).rejects.toThrow();
    });
  });
});