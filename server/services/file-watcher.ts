import { watch, FSWatcher } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import * as dotenv from 'dotenv';
import { mcpMemoryKeeper, createFileChangeMemoryItem } from './mcp-client';
import type { MCPCategory } from '../types/mcp';

dotenv.config();

interface FileChange {
  path: string;
  type: 'add' | 'change' | 'unlink';
  timestamp: Date;
  hash?: string;
  size?: number;
}

interface WatcherOptions {
  paths: string[];
  ignore?: RegExp[];
  debounceMs?: number;
  backupEnabled?: boolean;
  backupDir?: string;
  maxBackups?: number;
}

export class FileWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private fileHashes: Map<string, string> = new Map();
  private changeHistory: FileChange[] = [];
  private options: Required<WatcherOptions>;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: WatcherOptions) {
    super();
    this.options = {
      paths: options.paths,
      ignore: options.ignore || [/node_modules/, /\.git/, /\.next/, /dist/, /\.env/, /\.log$/],
      debounceMs: options.debounceMs || 500,
      backupEnabled: options.backupEnabled ?? true,
      backupDir: options.backupDir || './backups/file-watcher',
      maxBackups: options.maxBackups || 10,
    };

    this.initialize();
  }

  private async initialize() {
    // Create backup directory if needed
    if (this.options.backupEnabled) {
      await mkdir(this.options.backupDir, { recursive: true });
    }

    // Start watching
    for (const watchPath of this.options.paths) {
      this.startWatching(watchPath);
    }
  }

  private startWatching(watchPath: string) {
    if (this.watchers.has(watchPath)) {
      return;
    }

    const watcher = watch(watchPath, { recursive: true }, async (eventType, filename) => {
      if (!filename) return;

      const fullPath = path.join(watchPath, filename);

      // Check if file should be ignored
      if (this.shouldIgnore(fullPath)) {
        return;
      }

      // Debounce the change event
      this.debounceChange(fullPath, async () => {
        await this.handleFileChange(fullPath, eventType as 'rename' | 'change');
      });
    });

    watcher.on('error', (error) => {
      console.error(`Watcher error for ${watchPath}:`, error);
      this.emit('error', { path: watchPath, error });
    });

    this.watchers.set(watchPath, watcher);
    console.log(`📁 Watching: ${watchPath}`);
  }

  private shouldIgnore(filePath: string): boolean {
    return this.options.ignore.some((pattern) => pattern.test(filePath));
  }

  private debounceChange(filePath: string, callback: () => Promise<void>) {
    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      await callback();
      this.debounceTimers.delete(filePath);
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private async handleFileChange(filePath: string, _eventType: 'rename' | 'change') {
    try {
      // Try to read the file
      let fileContent: Buffer | null = null;
      let fileHash: string | undefined;
      let fileSize: number | undefined;

      try {
        // Try MCP filesystem first for reading (if text file)
        if (filePath.match(/\.(ts|tsx|js|jsx|json|md|txt|yml|yaml)$/i)) {
          const textContent = await mcpFilesystem.readTextFile(filePath);
          fileContent = Buffer.from(textContent, 'utf-8');
        } else {
          // For binary files, use native fs
          fileContent = await readFile(filePath);
        }
        fileHash = this.calculateHash(fileContent);
        fileSize = fileContent.length;
      } catch {
        // Try fallback to native fs
        try {
          fileContent = await readFile(filePath);
          fileHash = this.calculateHash(fileContent);
          fileSize = fileContent.length;
        } catch (_fallbackErr) {
          // File might have been deleted
          if ((_fallbackErr as any).code === 'ENOENT') {
            await this.handleFileDeletion(filePath);
            return;
          }
          throw _fallbackErr;
        }
      }

      // Check if file actually changed (by comparing hashes)
      const previousHash = this.fileHashes.get(filePath);
      if (previousHash === fileHash) {
        return; // No actual change
      }

      // Record the change
      const change: FileChange = {
        path: filePath,
        type: previousHash ? 'change' : 'add',
        timestamp: new Date(),
        hash: fileHash,
        size: fileSize,
      };

      this.changeHistory.push(change);
      this.fileHashes.set(filePath, fileHash);

      // Create backup if enabled
      if (this.options.backupEnabled && fileContent) {
        await this.createBackup(filePath, fileContent);
      }

      // Emit change event
      this.emit('change', change);
      console.log(`📝 File ${change.type}: ${filePath}`);

      // Store in memory keeper for persistence
      await this.saveToMemory(change);
    } catch (error) {
      console.error(`Error handling file change for ${filePath}:`, error);
      this.emit('error', { path: filePath, error });
    }
  }

  private async handleFileDeletion(filePath: string) {
    const change: FileChange = {
      path: filePath,
      type: 'unlink',
      timestamp: new Date(),
    };

    this.changeHistory.push(change);
    this.fileHashes.delete(filePath);

    this.emit('change', change);
    console.log(`🗑️ File deleted: ${filePath}`);

    await this.saveToMemory(change);
  }

  private calculateHash(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async createBackup(filePath: string, content: Buffer) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = path.basename(filePath);
      const backupName = `${timestamp}_${fileName}`;
      const backupPath = path.join(this.options.backupDir, backupName);

      await writeFile(backupPath, content);

      // Clean old backups
      await this.cleanOldBackups(fileName);

      console.log(`💾 Backup created: ${backupPath}`);
    } catch (error) {
      console.error(`Failed to create backup for ${filePath}:`, error);
    }
  }

  private async cleanOldBackups(_fileName: string) {
    // Implementation would list all backups for this file
    // and delete oldest ones if exceeding maxBackups
    // Simplified for brevity
  }

  private async saveToMemory(change: FileChange) {
    // Integrate with the memory-keeper MCP tool to persist file change history
    try {
      // Create structured memory item using the utility function
      const memoryItem = createFileChangeMemoryItem(change.path, change.type, {
        timestamp: change.timestamp,
        hash: change.hash,
        size: change.size,
      });

      // Save to memory-keeper via MCP client
      const success = await mcpMemoryKeeper.save(memoryItem);
      
      if (success) {
        console.log(`💾 [FileWatcher] Saved to memory: ${memoryItem.key} (${memoryItem.category}/${memoryItem.priority})`);
      } else {
        console.warn(`⚠️ [FileWatcher] Failed to save to memory: ${memoryItem.key}`);
      }
      
    } catch (error) {
      console.error('Failed to save file change to memory:', error);
    }
  }

  public getChangeHistory(limit?: number): FileChange[] {
    if (limit) {
      return this.changeHistory.slice(-limit);
    }
    return [...this.changeHistory];
  }

  public getFileHash(filePath: string): string | undefined {
    return this.fileHashes.get(filePath);
  }

  public async addPath(watchPath: string) {
    this.options.paths.push(watchPath);
    this.startWatching(watchPath);
  }

  public removePath(watchPath: string) {
    const watcher = this.watchers.get(watchPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(watchPath);
      console.log(`🛑 Stopped watching: ${watchPath}`);
    }

    const index = this.options.paths.indexOf(watchPath);
    if (index > -1) {
      this.options.paths.splice(index, 1);
    }
  }

  public stop() {
    for (const [path, watcher] of this.watchers) {
      watcher.close();
      console.log(`🛑 Stopped watching: ${path}`);
    }
    this.watchers.clear();
  }

  /**
   * Get memory-keeper integration status
   */
  public getMemoryKeeperStatus(): { enabled: boolean; integrated: boolean } {
    return {
      enabled: mcpMemoryKeeper.isMemoryKeeperEnabled(),
      integrated: true,
    };
  }

  /**
   * Enable or disable memory-keeper integration
   */
  public setMemoryKeeperEnabled(enabled: boolean): void {
    mcpMemoryKeeper.setEnabled(enabled);
    console.log(`[FileWatcher] Memory-keeper integration ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Search file changes in memory-keeper
   */
  public async searchMemoryChanges(query: string, options?: {
    category?: MCPCategory;
    limit?: number;
  }): Promise<any[] | null> {
    return await mcpMemoryKeeper.search({
      query,
      category: options?.category,
      channel: 'file-watcher',
      limit: options?.limit || 20,
      sort: 'created_desc',
    });
  }

  /**
   * Get file change history from memory-keeper
   */
  public async getMemoryChangeHistory(filePath?: string): Promise<any[] | null> {
    if (filePath) {
      const memoryKey = `file-change-${filePath.replace(/[/\\]/g, '-').replace(/[:.]/g, '_')}`;
      return await mcpMemoryKeeper.get(memoryKey);
    }
    
    return await mcpMemoryKeeper.search({
      query: '',
      channel: 'file-watcher',
      limit: 100,
      sort: 'created_desc',
    });
  }

  /**
   * Cache current file states for change detection
   */
  public async cacheCurrentFiles(): Promise<void> {
    console.log('[FileWatcher] Caching current file states...');
    
    for (const [filePath, _hash] of this.fileHashes) {
      try {
        const content = await readFile(filePath, 'utf-8');
        await mcpMemoryKeeper.cacheFile(filePath, content);
      } catch (error) {
        console.error(`Failed to cache file ${filePath}:`, error);
      }
    }
    
    console.log(`[FileWatcher] Cached ${this.fileHashes.size} files`);
  }
}

// Factory function to create and start file watcher
export function createFileWatcher(options: WatcherOptions): FileWatcher {
  return new FileWatcher(options);
}

// Default watcher for the project
export const projectWatcher = createFileWatcher({
  paths: ['./server', './client/src', './shared'],
  ignore: [
    /node_modules/,
    /\.git/,
    /\.next/,
    /dist/,
    /\.env/,
    /\.log$/,
    /\.(jpg|jpeg|png|gif|svg|ico)$/i,
  ],
  debounceMs: 1000,
  backupEnabled: true,
  backupDir: './backups/file-watcher',
  maxBackups: 5,
});

// Enable memory-keeper integration based on environment
if (process.env.MCP_ENABLED === 'true' || process.env.NODE_ENV === 'development') {
  projectWatcher.setMemoryKeeperEnabled(true);
  console.log('🧠 [FileWatcher] Memory-keeper integration enabled');
} else {
  console.log('📝 [FileWatcher] Memory-keeper integration disabled (set MCP_ENABLED=true to enable)');
}

// Listen to file changes
projectWatcher.on('change', (change: FileChange) => {
  // Log important changes
  if (change.path.endsWith('.ts') || change.path.endsWith('.tsx')) {
    console.log(`[FileWatcher] TypeScript file ${change.type}: ${change.path}`);
  }
  
  // Log high priority changes
  const memoryItem = createFileChangeMemoryItem(change.path, change.type, {
    timestamp: change.timestamp,
    hash: change.hash,
    size: change.size,
  });
  
  if (memoryItem.priority === 'high') {
    console.log(`🔥 [FileWatcher] High priority file ${change.type}: ${change.path}`);
  }
});

projectWatcher.on('error', ({ path, error }) => {
  console.error(`[FileWatcher] Error watching ${path}:`, error);
});
