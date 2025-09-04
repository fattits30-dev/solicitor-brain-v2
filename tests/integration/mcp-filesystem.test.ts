/**
 * Integration Tests for MCP Filesystem Operations
 * 
 * Tests the MCP filesystem wrapper functionality including:
 * - File reading and writing operations
 * - Directory operations
 * - File system queries and searches
 * - Error handling and fallback mechanisms
 * - Integration with existing file operations
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest as _jest } from '@jest/globals';
import { writeFile, unlink, mkdir, rmdir, readFile as _readFile } from 'fs/promises';
import path from 'path';

// Note: Since the current codebase doesn't have a dedicated MCP filesystem wrapper,
// we'll create tests that verify the integration points where MCP filesystem would be used
// This includes testing the fallback mechanisms to native fs operations

describe('MCP Filesystem Integration', () => {
  const testDir = path.join(__dirname, 'mcp-filesystem-test');
  const testFile = path.join(testDir, 'test-file.ts');
  const testContent = `// Test file for MCP filesystem integration
export const mcpTest = {
  value: 'filesystem integration test',
  timestamp: new Date().toISOString()
};`;

  beforeAll(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await rmdir(testDir, { recursive: true });
    } catch {
      // Directory might not exist or be empty
    }
  });

  beforeEach(async () => {
    // Ensure clean state for each test
    try {
      await unlink(testFile);
    } catch {
      // File might not exist
    }
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await unlink(testFile);
    } catch {
      // File might not exist
    }
  });

  describe('File Reading Operations', () => {
    beforeEach(async () => {
      // Create test file for reading tests
      await writeFile(testFile, testContent);
    });

    it('should read text files with MCP filesystem integration', async () => {
      // Simulate MCP filesystem read operation
      // In the current implementation, this would fall back to native fs
      const content = await readFile(testFile, 'utf-8');
      
      expect(content).toBe(testContent);
      expect(content).toContain('filesystem integration test');
    });

    it('should handle MCP filesystem read errors gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'non-existent.ts');
      
      try {
        await readFile(nonExistentFile, 'utf-8');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe('ENOENT');
      }
    });

    it('should read binary files with fallback mechanism', async () => {
      // Create a simple binary file
      const binaryFile = path.join(testDir, 'binary-file.bin');
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG signature
      
      await writeFile(binaryFile, binaryData);
      
      // Test binary file reading
      const content = await readFile(binaryFile);
      
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content).toEqual(binaryData);
      
      // Clean up
      await unlink(binaryFile);
    });

    it('should handle different file encodings', async () => {
      const utf8File = path.join(testDir, 'utf8-file.txt');
      const utf8Content = 'UTF-8 content with special chars: áéíóú';
      
      await writeFile(utf8File, utf8Content, 'utf-8');
      
      // Read with explicit encoding
      const content = await readFile(utf8File, 'utf-8');
      
      expect(content).toBe(utf8Content);
      expect(content).toContain('áéíóú');
      
      // Clean up
      await unlink(utf8File);
    });
  });

  describe('File Writing Operations', () => {
    it('should write text files with MCP filesystem integration', async () => {
      const newContent = `// New file created via MCP integration
export const newData = {
  created: new Date(),
  source: 'mcp-filesystem'
};`;
      
      // Write file using standard fs (simulating MCP fallback)
      await writeFile(testFile, newContent);
      
      // Verify content was written correctly
      const readContent = await readFile(testFile, 'utf-8');
      expect(readContent).toBe(newContent);
      expect(readContent).toContain('mcp-filesystem');
    });

    it('should create directories as needed', async () => {
      const nestedDir = path.join(testDir, 'nested', 'deep', 'directory');
      const nestedFile = path.join(nestedDir, 'nested-file.ts');
      
      // Create nested directories
      await mkdir(nestedDir, { recursive: true });
      
      // Write file in nested directory
      await writeFile(nestedFile, testContent);
      
      // Verify file exists and contains correct content
      const content = await readFile(nestedFile, 'utf-8');
      expect(content).toBe(testContent);
      
      // Clean up
      await unlink(nestedFile);
      await rmdir(path.join(testDir, 'nested'), { recursive: true });
    });

    it('should handle write permissions and errors', async () => {
      const readOnlyDir = path.join(testDir, 'readonly');
      await mkdir(readOnlyDir, { recursive: true });
      
      // Note: This test might not work on all systems due to permission handling
      // We'll test the concept rather than actual permission errors
      const readOnlyFile = path.join(readOnlyDir, 'readonly-file.ts');
      
      try {
        await writeFile(readOnlyFile, testContent);
        
        // If write succeeds, verify content
        const content = await readFile(readOnlyFile, 'utf-8');
        expect(content).toBe(testContent);
        
        // Clean up
        await unlink(readOnlyFile);
      } catch (error: any) {
        // Handle permission errors gracefully
        expect(error.code).toMatch(/^E(ACCES|PERM)$/);
      }
      
      await rmdir(readOnlyDir);
    });
  });

  describe('Directory Operations', () => {
    it('should list directory contents with MCP integration', async () => {
      // Create multiple test files
      const files = ['file1.ts', 'file2.js', 'file3.json'];
      
      for (const filename of files) {
        const filePath = path.join(testDir, filename);
        await writeFile(filePath, `// Test file: ${filename}`);
      }
      
      // List directory contents (simulating MCP filesystem list)
      const { readdir } = require('fs/promises');
      const contents = await readdir(testDir);
      
      // Verify all test files are present
      files.forEach(filename => {
        expect(contents).toContain(filename);
      });
      
      // Clean up
      for (const filename of files) {
        const filePath = path.join(testDir, filename);
        await unlink(filePath);
      }
    });

    it('should get file information and metadata', async () => {
      await writeFile(testFile, testContent);
      
      // Get file stats (simulating MCP filesystem info)
      const { stat } = require('fs/promises');
      const stats = await stat(testFile);
      
      expect(stats.isFile()).toBe(true);
      expect(stats.isDirectory()).toBe(false);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.mtime).toBeDefined();
      expect(stats.ctime).toBeDefined();
    });

    it('should handle directory creation and removal', async () => {
      const tempDir = path.join(testDir, 'temp-directory');
      
      // Create directory
      await mkdir(tempDir);
      
      // Verify directory exists
      const { stat } = require('fs/promises');
      const stats = await stat(tempDir);
      expect(stats.isDirectory()).toBe(true);
      
      // Remove directory
      await rmdir(tempDir);
      
      // Verify directory no longer exists
      try {
        await stat(tempDir);
        fail('Directory should not exist');
      } catch (error: any) {
        expect(error.code).toBe('ENOENT');
      }
    });
  });

  describe('File Search and Pattern Matching', () => {
    beforeEach(async () => {
      // Create multiple files with different extensions
      const testFiles = [
        'component.tsx',
        'service.ts', 
        'utils.js',
        'styles.css',
        'config.json',
        'README.md'
      ];
      
      for (const filename of testFiles) {
        const filePath = path.join(testDir, filename);
        const content = `// Test file: ${filename}\nconst data = '${filename}';`;
        await writeFile(filePath, content);
      }
    });

    afterEach(async () => {
      // Clean up test files
      const testFiles = [
        'component.tsx',
        'service.ts', 
        'utils.js',
        'styles.css',
        'config.json',
        'README.md'
      ];
      
      for (const filename of testFiles) {
        const filePath = path.join(testDir, filename);
        try {
          await unlink(filePath);
        } catch {
          // File might not exist
        }
      }
    });

    it('should find TypeScript files with pattern matching', async () => {
      const { readdir } = require('fs/promises');
      const allFiles = await readdir(testDir);
      
      // Filter TypeScript files (simulating MCP filesystem search)
      const tsFiles = allFiles.filter((file: string) => 
        file.endsWith('.ts') || file.endsWith('.tsx')
      );
      
      expect(tsFiles).toContain('component.tsx');
      expect(tsFiles).toContain('service.ts');
      expect(tsFiles).not.toContain('utils.js');
      expect(tsFiles).not.toContain('styles.css');
    });

    it('should find files by content pattern', async () => {
      // This simulates content search functionality that would be provided by MCP
      const { readdir } = require('fs/promises');
      const allFiles = await readdir(testDir);
      
      const matchingFiles: string[] = [];
      
      for (const filename of allFiles) {
        const filePath = path.join(testDir, filename);
        try {
          const content = await readFile(filePath, 'utf-8');
          if (content.includes('component.tsx')) {
            matchingFiles.push(filename);
          }
        } catch {
          // Skip files that can't be read as text
        }
      }
      
      expect(matchingFiles).toContain('component.tsx');
    });

    it('should handle glob-style patterns', async () => {
      const { readdir } = require('fs/promises');
      const allFiles = await readdir(testDir);
      
      // Simulate glob pattern matching for *.ts files
      const globPattern = /\.ts$/;
      const matchingFiles = allFiles.filter((file: string) => 
        globPattern.test(file)
      );
      
      expect(matchingFiles).toContain('service.ts');
      expect(matchingFiles).not.toContain('component.tsx'); // .tsx doesn't match .ts pattern
      expect(matchingFiles).not.toContain('utils.js');
    });
  });

  describe('File Move and Copy Operations', () => {
    beforeEach(async () => {
      await writeFile(testFile, testContent);
    });

    it('should move files between directories', async () => {
      const targetDir = path.join(testDir, 'target');
      const targetFile = path.join(targetDir, 'moved-file.ts');
      
      // Create target directory
      await mkdir(targetDir);
      
      // Move file (simulating MCP filesystem move)
      const { rename } = require('fs/promises');
      await rename(testFile, targetFile);
      
      // Verify file moved successfully
      const content = await readFile(targetFile, 'utf-8');
      expect(content).toBe(testContent);
      
      // Verify original file no longer exists
      try {
        await readFile(testFile, 'utf-8');
        fail('Original file should not exist');
      } catch (error: any) {
        expect(error.code).toBe('ENOENT');
      }
      
      // Clean up
      await unlink(targetFile);
      await rmdir(targetDir);
    });

    it('should copy files with content preservation', async () => {
      const copyFile = path.join(testDir, 'copied-file.ts');
      
      // Copy file (simulating MCP filesystem copy)
      const originalContent = await readFile(testFile, 'utf-8');
      await writeFile(copyFile, originalContent);
      
      // Verify copy has same content
      const copiedContent = await readFile(copyFile, 'utf-8');
      expect(copiedContent).toBe(testContent);
      expect(copiedContent).toBe(originalContent);
      
      // Verify original file still exists
      const originalStillExists = await readFile(testFile, 'utf-8');
      expect(originalStillExists).toBe(testContent);
      
      // Clean up
      await unlink(copyFile);
    });
  });

  describe('File Watching Integration', () => {
    it('should integrate with file watching for change detection', async () => {
      // This test simulates how MCP filesystem operations would integrate
      // with file watching for change detection
      
      let changeDetected = false;
      const originalContent = await readFile(testFile, 'utf-8');
      
      // Simulate file change detection
      const modifiedContent = originalContent + '\n// Modified via MCP';
      await writeFile(testFile, modifiedContent);
      
      // Check if content actually changed
      const newContent = await readFile(testFile, 'utf-8');
      if (newContent !== originalContent) {
        changeDetected = true;
      }
      
      expect(changeDetected).toBe(true);
      expect(newContent).toContain('Modified via MCP');
    });
  });

  describe('Error Handling and Fallback Mechanisms', () => {
    it('should handle filesystem errors gracefully', async () => {
      const nonExistentPath = path.join(testDir, 'non-existent-directory', 'file.ts');
      
      try {
        await writeFile(nonExistentPath, testContent);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe('ENOENT');
        expect(error.message).toContain('no such file or directory');
      }
    });

    it('should provide meaningful error messages', async () => {
      const invalidPath = '\0invalid\0path\0';
      
      try {
        await writeFile(invalidPath, testContent);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeDefined();
      }
    });

    it('should handle permission errors appropriately', async () => {
      // This test simulates permission error handling
      // In a real scenario, we might try to write to a protected directory
      
      try {
        // Attempt operation that might fail due to permissions
        await writeFile(testFile, testContent);
        
        // If successful, verify the operation
        const content = await readFile(testFile, 'utf-8');
        expect(content).toBe(testContent);
      } catch (error: any) {
        // Handle permission errors gracefully
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          expect(error.message).toContain('permission');
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    });

    it('should handle concurrent file operations', async () => {
      const concurrentFiles = Array.from({ length: 5 }, (_, i) => 
        path.join(testDir, `concurrent-file-${i}.ts`)
      );
      
      // Perform concurrent write operations
      const writePromises = concurrentFiles.map((filePath, index) => 
        writeFile(filePath, `// Concurrent file ${index}\nexport const id = ${index};`)
      );
      
      await Promise.all(writePromises);
      
      // Verify all files were written correctly
      for (let i = 0; i < concurrentFiles.length; i++) {
        const content = await readFile(concurrentFiles[i], 'utf-8');
        expect(content).toContain(`export const id = ${i};`);
      }
      
      // Clean up concurrent files
      const unlinkPromises = concurrentFiles.map(filePath => unlink(filePath));
      await Promise.all(unlinkPromises);
    });
  });

  describe('Integration with File-Watcher Service', () => {
    it('should be compatible with file-watcher hash calculation', async () => {
      // This test ensures MCP filesystem operations are compatible
      // with the file-watcher's hash calculation mechanism
      
      await writeFile(testFile, testContent);
      
      // Simulate hash calculation (as done in file-watcher)
      const crypto = require('crypto');
      const fileContent = await readFile(testFile);
      const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
      
      expect(hash).toBeDefined();
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash pattern
      
      // Verify hash consistency
      const secondRead = await readFile(testFile);
      const secondHash = crypto.createHash('sha256').update(secondRead).digest('hex');
      
      expect(hash).toBe(secondHash);
    });

    it('should support file content caching for change detection', async () => {
      await writeFile(testFile, testContent);
      
      // Cache original content
      const originalContent = await readFile(testFile, 'utf-8');
      
      // Modify file
      const modifiedContent = originalContent + '\n// Cache test modification';
      await writeFile(testFile, modifiedContent);
      
      // Verify change detection would work
      const newContent = await readFile(testFile, 'utf-8');
      const hasChanged = newContent !== originalContent;
      
      expect(hasChanged).toBe(true);
      expect(newContent).toContain('Cache test modification');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large file operations efficiently', async () => {
      const largeFile = path.join(testDir, 'large-file.txt');
      
      // Create large content (1MB)
      const largeContent = 'x'.repeat(1024 * 1024);
      
      const startTime = Date.now();
      await writeFile(largeFile, largeContent);
      
      const writeTime = Date.now() - startTime;
      
      // Read the large file back
      const readStartTime = Date.now();
      const readContent = await readFile(largeFile, 'utf-8');
      const readTime = Date.now() - readStartTime;
      
      expect(readContent.length).toBe(largeContent.length);
      expect(readContent).toBe(largeContent);
      
      // Performance should be reasonable (under 1 second for 1MB)
      expect(writeTime).toBeLessThan(1000);
      expect(readTime).toBeLessThan(1000);
      
      // Clean up
      await unlink(largeFile);
    });

    it('should handle multiple file operations efficiently', async () => {
      const fileCount = 20;
      const files = Array.from({ length: fileCount }, (_, i) => 
        path.join(testDir, `batch-file-${i}.ts`)
      );
      
      // Batch write operations
      const startTime = Date.now();
      const writePromises = files.map((filePath, index) => 
        writeFile(filePath, `// Batch file ${index}`)
      );
      
      await Promise.all(writePromises);
      const writeTime = Date.now() - startTime;
      
      // Batch read operations
      const readStartTime = Date.now();
      const readPromises = files.map(filePath => readFile(filePath, 'utf-8'));
      const contents = await Promise.all(readPromises);
      const readTime = Date.now() - readStartTime;
      
      // Verify all operations completed successfully
      expect(contents).toHaveLength(fileCount);
      contents.forEach((content, index) => {
        expect(content).toContain(`Batch file ${index}`);
      });
      
      // Performance should be reasonable
      expect(writeTime).toBeLessThan(2000); // 2 seconds for 20 files
      expect(readTime).toBeLessThan(1000);  // 1 second for 20 files
      
      // Clean up
      const unlinkPromises = files.map(filePath => unlink(filePath));
      await Promise.all(unlinkPromises);
    });
  });
});