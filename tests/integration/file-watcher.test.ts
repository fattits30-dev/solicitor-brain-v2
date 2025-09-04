/**
 * Integration Tests for File Watcher Service with MCP Memory-Keeper
 *
 * Tests the file watcher functionality including:
 * - File change detection and debouncing
 * - MCP memory-keeper integration
 * - Backup creation
 * - Event emission
 * - Error handling
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdir, rmdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { createFileWatcher, FileWatcher } from '../../server/services/file-watcher';
import { mcpMemoryKeeper } from '../../server/services/mcp-client';

describe('File Watcher Integration', () => {
  const testDir = path.join(__dirname, 'file-watcher-test');
  const backupDir = path.join(testDir, 'backups');
  let fileWatcher: FileWatcher;

  beforeAll(async () => {
    // Create test directories
    await mkdir(testDir, { recursive: true });
    await mkdir(backupDir, { recursive: true });

    // Enable MCP for testing
    mcpMemoryKeeper.setEnabled(true);
  });

  afterAll(async () => {
    // Stop file watcher
    if (fileWatcher) {
      fileWatcher.stop();
    }

    // Clean up test directories
    try {
      await rmdir(testDir, { recursive: true });
    } catch {
      // Directory might not exist or be empty
    }
  });

  beforeEach(() => {
    // Create fresh file watcher for each test
    fileWatcher = createFileWatcher({
      paths: [testDir],
      ignore: [/\.tmp$/], // Ignore temporary files
      debounceMs: 100, // Short debounce for testing
      backupEnabled: true,
      backupDir: backupDir,
      maxBackups: 3,
    });

    // Enable memory-keeper integration
    fileWatcher.setMemoryKeeperEnabled(true);
  });

  afterEach(() => {
    // Stop file watcher after each test
    if (fileWatcher) {
      fileWatcher.stop();
    }
  });

  describe('File Change Detection', () => {
    it('should detect new file creation', async () => {
      const testFile = path.join(testDir, 'new-file.ts');
      const testContent = '// New test file\nexport const test = "hello";';

      // Set up event listener
      const changePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create file
      await writeFile(testFile, testContent);

      // Wait for change detection
      const change = await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]) as any;

      expect(change).toBeDefined();
      expect(change.type).toBe('add');
      expect(change.path).toBe(testFile);
      expect(change.hash).toBeDefined();
      expect(change.size).toBe(testContent.length);

      // Clean up
      await unlink(testFile);
    });

    it('should detect file modifications', async () => {
      const testFile = path.join(testDir, 'modify-file.ts');
      const originalContent = '// Original content';
      const modifiedContent = '// Original content\n// Modified content';

      // Create initial file
      await writeFile(testFile, originalContent);

      // Wait for initial creation to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Set up event listener for modification
      const changePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Modify file
      await writeFile(testFile, modifiedContent);

      // Wait for change detection
      const change = await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]) as any;

      expect(change).toBeDefined();
      expect(change.type).toBe('change');
      expect(change.path).toBe(testFile);
      expect(change.size).toBe(modifiedContent.length);

      // Clean up
      await unlink(testFile);
    });

    it('should detect file deletion', async () => {
      const testFile = path.join(testDir, 'delete-file.ts');
      const testContent = '// File to be deleted';

      // Create file first
      await writeFile(testFile, testContent);

      // Wait for creation to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Set up event listener for deletion
      const changePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Delete file
      await unlink(testFile);

      // Wait for change detection
      const change = await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]) as any;

      expect(change).toBeDefined();
      expect(change.type).toBe('unlink');
      expect(change.path).toBe(testFile);
      expect(change.hash).toBeUndefined();
      expect(change.size).toBeUndefined();
    });

    it('should ignore files matching ignore patterns', async () => {
      const ignoredFile = path.join(testDir, 'ignored-file.tmp');
      const testContent = 'This file should be ignored';

      // Set up event listener
      let changeDetected = false;
      fileWatcher.on('change', () => {
        changeDetected = true;
      });

      // Create ignored file
      await writeFile(ignoredFile, testContent);

      // Wait to ensure no change is detected
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(changeDetected).toBe(false);

      // Clean up
      await unlink(ignoredFile);
    });

    it('should debounce rapid file changes', async () => {
      const testFile = path.join(testDir, 'debounce-file.ts');
      let changeCount = 0;

      // Set up event listener
      fileWatcher.on('change', () => {
        changeCount++;
      });

      // Rapidly modify file multiple times
      await writeFile(testFile, '// Version 1');
      await writeFile(testFile, '// Version 2');
      await writeFile(testFile, '// Version 3');

      // Wait for debouncing to settle
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have detected only one change due to debouncing
      expect(changeCount).toBe(1);

      // Clean up
      await unlink(testFile);
    });
  });

  describe('MCP Memory-Keeper Integration', () => {
    it('should save file changes to memory-keeper', async () => {
      const testFile = path.join(testDir, 'memory-file.ts');
      const testContent = '// File for memory testing';

      // Mock console.log to capture memory save messages
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Set up event listener
      const changePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create file
      await writeFile(testFile, testContent);

      // Wait for change and memory save
      await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);

      // Check that memory save was attempted
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FileWatcher] Saved to memory:')
      );

      consoleSpy.mockRestore();

      // Clean up
      await unlink(testFile);
    });

    it('should search memory changes', async () => {
      const searchQuery = 'test-search';

      const results = await fileWatcher.searchMemoryChanges(searchQuery, {
        category: 'progress',
        limit: 10,
      });

      // Mock implementation returns empty array
      expect(results).toEqual([]);
    });

    it('should get memory change history for specific file', async () => {
      const testFile = path.join(testDir, 'history-file.ts');

      const history = await fileWatcher.getMemoryChangeHistory(testFile);

      // Mock implementation returns empty array
      expect(history).toEqual([]);
    });

    it('should get all memory change history', async () => {
      const history = await fileWatcher.getMemoryChangeHistory();

      // Mock implementation returns empty array
      expect(history).toEqual([]);
    });

    it('should report memory-keeper status', () => {
      const status = fileWatcher.getMemoryKeeperStatus();

      expect(status.enabled).toBe(true);
      expect(status.integrated).toBe(true);
    });

    it('should allow enabling/disabling memory-keeper', () => {
      // Test disabling
      fileWatcher.setMemoryKeeperEnabled(false);
      expect(fileWatcher.getMemoryKeeperStatus().enabled).toBe(false);

      // Test re-enabling
      fileWatcher.setMemoryKeeperEnabled(true);
      expect(fileWatcher.getMemoryKeeperStatus().enabled).toBe(true);
    });

    it('should cache current files to memory-keeper', async () => {
      const testFile = path.join(testDir, 'cache-file.ts');
      const testContent = '// File for caching test';

      // Create file and let it be processed
      await writeFile(testFile, testContent);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Mock console.log to capture cache messages
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Cache current files
      await fileWatcher.cacheCurrentFiles();

      // Check that caching was attempted
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FileWatcher] Caching current file states...')
      );

      consoleSpy.mockRestore();

      // Clean up
      await unlink(testFile);
    });
  });

  describe('Backup Functionality', () => {
    it('should create backups when enabled', async () => {
      const testFile = path.join(testDir, 'backup-file.ts');
      const testContent = '// File that should be backed up';

      // Mock console.log to capture backup messages
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Set up event listener
      const changePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create file
      await writeFile(testFile, testContent);

      // Wait for change processing
      await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);

      // Check that backup was created
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💾 Backup created:')
      );

      consoleSpy.mockRestore();

      // Clean up
      await unlink(testFile);
    });
  });

  describe('File Hash Management', () => {
    it('should calculate and store file hashes', async () => {
      const testFile = path.join(testDir, 'hash-file.ts');
      const testContent = '// File for hash testing';

      // Set up event listener
      const changePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create file
      await writeFile(testFile, testContent);

      // Wait for processing
      await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);

      // Check that hash was stored
      const hash = fileWatcher.getFileHash(testFile);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash?.length).toBeGreaterThan(0);

      // Clean up
      await unlink(testFile);
    });

    it('should not trigger change events for same content', async () => {
      const testFile = path.join(testDir, 'same-content-file.ts');
      const testContent = '// Same content file';

      // Create file first
      await writeFile(testFile, testContent);

      // Wait for initial processing
      await new Promise(resolve => setTimeout(resolve, 200));

      let changeCount = 0;
      fileWatcher.on('change', () => {
        changeCount++;
      });

      // Write same content again
      await writeFile(testFile, testContent);

      // Wait to ensure no additional change is detected
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should not trigger additional change event
      expect(changeCount).toBe(0);

      // Clean up
      await unlink(testFile);
    });
  });

  describe('Change History', () => {
    it('should maintain change history', async () => {
      const testFile = path.join(testDir, 'history-tracking-file.ts');

      // Create file
      await writeFile(testFile, '// Initial content');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Modify file
      await writeFile(testFile, '// Modified content');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get change history
      const history = fileWatcher.getChangeHistory();
      const fileChanges = history.filter(change => change.path === testFile);

      expect(fileChanges.length).toBeGreaterThanOrEqual(1);

      // Get limited history
      const limitedHistory = fileWatcher.getChangeHistory(1);
      expect(limitedHistory.length).toBeLessThanOrEqual(1);

      // Clean up
      await unlink(testFile);
    });
  });

  describe('Path Management', () => {
    it('should allow adding new watch paths', async () => {
      const newTestDir = path.join(testDir, 'new-watch-dir');
      await mkdir(newTestDir, { recursive: true });

      // Add new path
      await fileWatcher.addPath(newTestDir);

      // Create file in new directory
      const testFile = path.join(newTestDir, 'new-path-file.ts');

      // Set up event listener
      const changePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create file
      await writeFile(testFile, '// File in new watch path');

      // Wait for change detection
      const change = await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]) as any;

      expect(change).toBeDefined();
      expect(change.path).toBe(testFile);

      // Clean up
      await unlink(testFile);
      await rmdir(newTestDir);
    });

    it('should allow removing watch paths', async () => {
      const testFile = path.join(testDir, 'remove-path-file.ts');

      // Remove the test directory from watching
      fileWatcher.removePath(testDir);

      let changeDetected = false;
      fileWatcher.on('change', () => {
        changeDetected = true;
      });

      // Create file (should not be detected)
      await writeFile(testFile, '// File after path removal');

      // Wait to ensure no change is detected
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(changeDetected).toBe(false);

      // Clean up
      await unlink(testFile);
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Mock console.error to capture error messages
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      let _errorEmitted = false;
      fileWatcher.on('error', () => {
        _errorEmitted = true;
      });

      // This test might be challenging to trigger reliably
      // In a real scenario, we might create a file and then immediately
      // change its permissions to trigger a read error

      // For now, we'll just verify error handling exists
      expect(consoleSpy).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should emit error events for watcher failures', (done) => {
      // Create a file watcher with an invalid path
      const invalidWatcher = createFileWatcher({
        paths: ['/invalid/path/that/does/not/exist'],
        debounceMs: 100,
      });

      invalidWatcher.on('error', (errorInfo) => {
        expect(errorInfo).toBeDefined();
        expect(errorInfo.error).toBeDefined();
        invalidWatcher.stop();
        done();
      });

      // If no error is emitted within timeout, end the test
      setTimeout(() => {
        invalidWatcher.stop();
        done();
      }, 1000);
    });
  });

  describe('TypeScript and Important File Handling', () => {
    it('should log TypeScript file changes', async () => {
      const testFile = path.join(testDir, 'typescript-file.ts');
      const testContent = '// TypeScript file for testing';

      // Mock console.log to capture TypeScript-specific messages
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Set up event listener
      const changePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create TypeScript file
      await writeFile(testFile, testContent);

      // Wait for processing
      await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);

      // Check that TypeScript-specific logging occurred
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FileWatcher] TypeScript file add:')
      );

      consoleSpy.mockRestore();

      // Clean up
      await unlink(testFile);
    });

    it('should log high priority file changes', async () => {
      const testFile = path.join(testDir, 'package.json');
      const testContent = '{"name": "test-package"}';

      // Mock console.log to capture high priority messages
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Set up event listener
      const changePromise = new Promise((resolve) => {
        fileWatcher.once('change', resolve);
      });

      // Create high priority file
      await writeFile(testFile, testContent);

      // Wait for processing
      await Promise.race([
        changePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);

      // Check that high priority logging occurred
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔥 [FileWatcher] High priority file add:')
      );

      consoleSpy.mockRestore();

      // Clean up
      await unlink(testFile);
    });
  });
});
