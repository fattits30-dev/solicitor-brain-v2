import { watch, FSWatcher } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { EventEmitter } from "events";
import * as dotenv from "dotenv";

dotenv.config();

interface FileChange {
  path: string;
  type: "add" | "change" | "unlink";
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
      ignore: options.ignore || [
        /node_modules/,
        /\.git/,
        /\.next/,
        /dist/,
        /\.env/,
        /\.log$/,
      ],
      debounceMs: options.debounceMs || 500,
      backupEnabled: options.backupEnabled ?? true,
      backupDir: options.backupDir || "./backups/file-watcher",
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

    const watcher = watch(
      watchPath,
      { recursive: true },
      async (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(watchPath, filename);
        
        // Check if file should be ignored
        if (this.shouldIgnore(fullPath)) {
          return;
        }

        // Debounce the change event
        this.debounceChange(fullPath, async () => {
          await this.handleFileChange(fullPath, eventType as "rename" | "change");
        });
      }
    );

    watcher.on("error", (error) => {
      console.error(`Watcher error for ${watchPath}:`, error);
      this.emit("error", { path: watchPath, error });
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

  private async handleFileChange(filePath: string, eventType: "rename" | "change") {
    try {
      // Try to read the file
      let fileContent: Buffer | null = null;
      let fileHash: string | undefined;
      let fileSize: number | undefined;

      try {
        fileContent = await readFile(filePath);
        fileHash = this.calculateHash(fileContent);
        fileSize = fileContent.length;
      } catch (err) {
        // File might have been deleted
        if ((err as any).code === "ENOENT") {
          await this.handleFileDeletion(filePath);
          return;
        }
        throw err;
      }

      // Check if file actually changed (by comparing hashes)
      const previousHash = this.fileHashes.get(filePath);
      if (previousHash === fileHash) {
        return; // No actual change
      }

      // Record the change
      const change: FileChange = {
        path: filePath,
        type: previousHash ? "change" : "add",
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
      this.emit("change", change);
      console.log(`📝 File ${change.type}: ${filePath}`);

      // Store in memory keeper for persistence
      await this.saveToMemory(change);

    } catch (error) {
      console.error(`Error handling file change for ${filePath}:`, error);
      this.emit("error", { path: filePath, error });
    }
  }

  private async handleFileDeletion(filePath: string) {
    const change: FileChange = {
      path: filePath,
      type: "unlink",
      timestamp: new Date(),
    };

    this.changeHistory.push(change);
    this.fileHashes.delete(filePath);

    this.emit("change", change);
    console.log(`🗑️ File deleted: ${filePath}`);

    await this.saveToMemory(change);
  }

  private calculateHash(content: Buffer): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private async createBackup(filePath: string, content: Buffer) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
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

  private async cleanOldBackups(fileName: string) {
    // Implementation would list all backups for this file
    // and delete oldest ones if exceeding maxBackups
    // Simplified for brevity
  }

  private async saveToMemory(change: FileChange) {
    // This would integrate with the memory-keeper MCP tool
    // to persist file change history
    try {
      // Store file change in context
      const memoryKey = `file-change-${change.path.replace(/\//g, "-")}`;
      const memoryValue = JSON.stringify(change);
      
      // In a real implementation, this would call:
      // await mcp__memory-keeper__context_save({
      //   key: memoryKey,
      //   value: memoryValue,
      //   category: "file-change",
      //   priority: "normal"
      // });
      
    } catch (error) {
      console.error("Failed to save to memory:", error);
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
}

// Factory function to create and start file watcher
export function createFileWatcher(options: WatcherOptions): FileWatcher {
  return new FileWatcher(options);
}

// Default watcher for the project
export const projectWatcher = createFileWatcher({
  paths: [
    "./server",
    "./client/src",
    "./shared",
  ],
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
  backupDir: "./backups/file-watcher",
  maxBackups: 5,
});

// Listen to file changes
projectWatcher.on("change", (change: FileChange) => {
  // Log important changes
  if (change.path.endsWith(".ts") || change.path.endsWith(".tsx")) {
    console.log(`[FileWatcher] TypeScript file ${change.type}: ${change.path}`);
  }
});

projectWatcher.on("error", ({ path, error }) => {
  console.error(`[FileWatcher] Error watching ${path}:`, error);
});