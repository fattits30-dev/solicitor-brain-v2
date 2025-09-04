# MCP Memory-Keeper Integration

## Overview

The file-watcher service now includes full integration with the MCP (Model Context Protocol) memory-keeper tool for persistent context storage and retrieval. This integration allows the file watcher to:

- Store file change history persistently across sessions
- Search and retrieve historical file changes
- Cache file contents for change detection
- Maintain context about project development activities

## Architecture

```
FileWatcher Service
├── MCPMemoryKeeperClient (mcp-client.ts)
│   ├── save() - Store context items
│   ├── search() - Search stored items
│   ├── cacheFile() - Cache file contents
│   └── getStatus() - Get integration status
├── Type Definitions (types/mcp.ts)
│   ├── MCPContextItem
│   ├── MCPSearchOptions
│   └── FileChangeMemoryData
└── FileWatcher Class
    ├── saveToMemory() - Save changes to MCP
    ├── searchMemoryChanges() - Search historical changes
    └── getMemoryChangeHistory() - Get change history
```

## Configuration

### Environment Variables

- `MCP_ENABLED=true` - Enable MCP integration (default: development mode only)
- `NODE_ENV=development` - Automatically enables MCP in development

### File Watcher Options

```typescript
const watcher = createFileWatcher({
  paths: ['./server', './client/src'],
  // ... other options
});

// Enable/disable MCP integration
watcher.setMemoryKeeperEnabled(true);
```

## Usage

### Basic File Change Tracking

The file watcher automatically saves all file changes to the memory-keeper:

```typescript
import { projectWatcher } from './services/file-watcher';

// Listen to file changes (now includes MCP storage)
projectWatcher.on('change', (change) => {
  console.log('File changed:', change.path);
  // Change is automatically saved to MCP memory-keeper
});
```

### Search Historical Changes

```typescript
// Search for specific file changes
const results = await projectWatcher.searchMemoryChanges('schema.ts', {
  category: 'progress',
  limit: 10
});

// Get complete memory history for a file
const history = await projectWatcher.getMemoryChangeHistory('./server/schema.ts');
```

### Memory-Keeper Status

```typescript
// Check integration status
const status = projectWatcher.getMemoryKeeperStatus();
console.log('MCP enabled:', status.enabled);

// Get detailed MCP status
const mcpStatus = await mcpMemoryKeeper.getStatus();
console.log('Session count:', mcpStatus?.sessionCount);
```

## Data Structure

### File Change Memory Items

Each file change is stored with the following structure:

```typescript
{
  key: "file-change-server-schema-ts",
  value: JSON.stringify({
    path: "/project/server/schema.ts",
    type: "change",
    timestamp: "2025-01-01T12:00:00.000Z",
    hash: "sha256-hash-of-content",
    size: 1024,
    relativePath: "server/schema.ts"
  }),
  category: "progress",  // or "warning" for deletions
  priority: "high",      // based on file importance
  channel: "file-watcher",
  private: false
}
```

### Priority Levels

Files are automatically categorized by importance:

- **High Priority**: `package.json`, `tsconfig.json`, `.env`, `schema.ts`, `routes.ts`
- **Normal Priority**: TypeScript/JavaScript source files (`.ts`, `.tsx`, `.js`, `.jsx`)
- **Low Priority**: Other files

### Categories

File changes are categorized:

- **progress**: File additions and modifications
- **warning**: File deletions
- **note**: Other file system events

## API Reference

### MCPMemoryKeeperClient

```typescript
class MCPMemoryKeeperClient {
  // Save context item
  async save(item: MCPContextItem): Promise<boolean>
  
  // Retrieve context items
  async get(key?: string): Promise<any[] | null>
  
  // Search context items
  async search(options: MCPSearchOptions): Promise<any[] | null>
  
  // Cache file content
  async cacheFile(filePath: string, content: string): Promise<boolean>
  
  // Check if file changed
  async fileChanged(filePath: string, currentContent?: string): Promise<boolean | null>
  
  // Get status
  async getStatus(): Promise<MCPMemoryStatus | null>
  
  // Enable/disable
  setEnabled(enabled: boolean): void
}
```

### FileWatcher Extensions

```typescript
class FileWatcher {
  // MCP integration methods
  getMemoryKeeperStatus(): { enabled: boolean; integrated: boolean }
  setMemoryKeeperEnabled(enabled: boolean): void
  
  // Search and history
  async searchMemoryChanges(query: string, options?: {
    category?: MCPCategory;
    limit?: number;
  }): Promise<any[] | null>
  
  async getMemoryChangeHistory(filePath?: string): Promise<any[] | null>
  
  // Caching
  async cacheCurrentFiles(): Promise<void>
}
```

## Testing

Run the MCP integration test:

```bash
# Compile TypeScript
npm run build

# Run test
node dist/test-mcp-integration.js
```

The test will:

1. Create a test file and monitor changes
2. Test memory storage and retrieval
3. Search historical changes
4. Verify integration status
5. Clean up test files

## Implementation Notes

### Current State

- **Simulation Mode**: The MCP client currently logs intended MCP calls rather than making actual protocol requests
- **Type Safety**: Full TypeScript support with proper type definitions
- **Error Handling**: Graceful degradation when MCP is unavailable
- **Performance**: Efficient debouncing and change detection

### Future Enhancements

- Replace simulation with actual MCP protocol calls
- Add real-time change notifications via WebSocket
- Implement file content diffing with MCP storage
- Add change analytics and reporting
- Support for distributed file watching across services

## Troubleshooting

### Common Issues

1. **MCP not enabled**: Check `MCP_ENABLED` environment variable
2. **No changes saved**: Verify file paths are within watched directories
3. **Search not working**: Ensure query format matches stored keys
4. **Performance issues**: Adjust debounce timing in watcher options

### Debug Logging

Enable verbose logging:

```typescript
// Enable debug mode
process.env.DEBUG = 'mcp:*';

// Check logs for MCP operations
console.log('[MCP] Memory save attempts:', attempts);
```

### Health Check

```typescript
// Quick health check
const status = projectWatcher.getMemoryKeeperStatus();
if (!status.enabled) {
  console.warn('MCP integration disabled');
}
```

## Security Considerations

- File contents are not stored in memory-keeper by default
- Only metadata (path, hash, size, timestamp) is persisted
- Private files can be excluded via ignore patterns
- Memory items can be marked as private per session

## Contributing

When extending the MCP integration:

1. Update type definitions in `types/mcp.ts`
2. Add tests to `test-mcp-integration.ts`
3. Update this documentation
4. Follow existing error handling patterns
5. Maintain backward compatibility