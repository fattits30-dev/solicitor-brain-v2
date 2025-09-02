# 🔍 Debugging Guide - Solicitor Brain v2

## Table of Contents
- [Quick Start](#quick-start)
- [Debug Infrastructure](#debug-infrastructure)
- [Debug Panel](#debug-panel)
- [Debug Routes](#debug-routes)
- [Debug Logging](#debug-logging)
- [Database Debugging](#database-debugging)
- [Performance Monitoring](#performance-monitoring)
- [VS Code Debugging](#vs-code-debugging)
- [Test Debugging](#test-debugging)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Enable Debug Mode

1. **Set environment variables** in `.env`:
```bash
DEBUG_LEVEL=DEBUG
ENABLE_DEBUG_PANEL=true
ENABLE_API_LOGGING=true
ENABLE_PERFORMANCE_LOGGING=true
ENABLE_QUERY_LOGGING=true
```

2. **Start development server**:
```bash
npm run dev:debug  # With Node.js inspector
# or
npm run dev        # Standard development mode
```

3. **Open Debug Panel**:
   - Click the bug icon (🐛) in the bottom-right corner
   - Or press `Ctrl+Shift+D`

---

## Debug Infrastructure

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| DebugLogger | `server/utils/debug.ts` | Central logging utility |
| Debug Routes | `server/routes/debug.ts` | Development-only API endpoints |
| Debug Panel | `client/src/components/debug/DebugPanel.tsx` | Client-side debug UI |
| Query Debugger | `server/db.ts` | Database query logging |

### Debug Levels

```typescript
ERROR   // Critical errors only
WARN    // Warnings and errors
INFO    // General information (default)
DEBUG   // Detailed debug information
TRACE   // Very detailed trace logs
```

---

## Debug Panel

### Features

The debug panel provides real-time insights into:
- **Logs**: Application logs with filtering
- **Health**: System health and metrics
- **Database**: Table statistics
- **Routes**: Available API endpoints
- **Environment**: Configuration values

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` | Toggle debug panel |
| `Esc` | Close debug panel |

### Tabs

#### Logs Tab
- View real-time application logs
- Filter by level and category
- Export logs as JSON
- Clear log history

#### Health Tab
- System status and uptime
- Memory usage statistics
- Database connection status
- CPU and system information

#### Database Tab
- Table row counts
- Connection pool statistics
- Query performance metrics

#### Routes Tab
- List of all API endpoints
- HTTP methods supported
- Route patterns

#### Environment Tab
- Current environment variables
- Sensitive values are redacted
- Configuration verification

---

## Debug Routes

All debug routes are available at `/api/debug/*` in development only.

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/debug/health` | GET | System health check |
| `/api/debug/env` | GET | Environment variables (sanitized) |
| `/api/debug/db-stats` | GET | Database statistics |
| `/api/debug/logs` | GET | Retrieve debug logs |
| `/api/debug/level` | POST | Change debug level |
| `/api/debug/logs` | DELETE | Clear debug logs |
| `/api/debug/performance` | GET | Performance metrics |
| `/api/debug/error-test` | GET | Test error handling |
| `/api/debug/routes` | GET | List all routes |
| `/api/debug/session` | GET | Session information |
| `/api/debug/cache` | GET | Cache statistics |

### Example Usage

```bash
# Check system health
curl http://localhost:3000/api/debug/health

# Get database statistics
curl http://localhost:3000/api/debug/db-stats

# Change debug level
curl -X POST http://localhost:3000/api/debug/level \
  -H "Content-Type: application/json" \
  -d '{"level": "DEBUG"}'

# Get logs with filters
curl "http://localhost:3000/api/debug/logs?category=DATABASE&limit=50"
```

---

## Debug Logging

### Using DebugLogger

```typescript
import { DebugLogger, perfMonitor } from './utils/debug';

// Basic logging
DebugLogger.error('Critical error occurred', error);
DebugLogger.warn('This might be a problem', data);
DebugLogger.info('User logged in', { userId: user.id });
DebugLogger.debug('Processing request', request);
DebugLogger.trace('Detailed trace information', details);

// Categorized logging
DebugLogger.info('Query executed', query, 'DATABASE');
DebugLogger.debug('API call', request, 'API_REQUEST');

// Performance monitoring
perfMonitor.start('api-call');
// ... do work
const duration = perfMonitor.end('api-call');

// Measure function execution
const result = perfMonitor.measure('expensive-operation', () => {
  return expensiveOperation();
});

// Async measurement
const data = await perfMonitor.measureAsync('fetch-data', async () => {
  return await fetchData();
});
```

### Log Categories

Common log categories:
- `DATABASE` - Database queries and connections
- `API_REQUEST` - Incoming API requests
- `API_RESPONSE` - Outgoing API responses
- `AUTH` - Authentication events
- `PERFORMANCE` - Performance metrics
- `ERROR` - Error handling
- `SECURITY` - Security-related events

---

## Database Debugging

### Enable Query Logging

Set in `.env`:
```bash
ENABLE_QUERY_LOGGING=true
DEBUG_LEVEL=DEBUG
```

### Query Log Format

```json
{
  "level": "DEBUG",
  "category": "DATABASE",
  "message": "SQL Query executed in 45ms",
  "data": {
    "query": "SELECT * FROM users WHERE id = $1",
    "params": ["user-123"],
    "duration": 45
  }
}
```

### Connection Pool Events

Monitor database connection pool:
- Client connected
- Client acquired
- Client released
- Pool errors

---

## Performance Monitoring

### API Performance

All API requests are automatically timed when `ENABLE_PERFORMANCE_LOGGING=true`.

### Custom Performance Metrics

```typescript
import { perfMonitor } from './utils/debug';

// Start a timer
perfMonitor.start('data-processing');

// Process data...
processLargeDataset();

// Stop timer and get duration
const duration = perfMonitor.end('data-processing');
console.log(`Processing took ${duration}ms`);
```

### Memory Monitoring

View memory usage in the Debug Panel's Health tab:
- RSS (Resident Set Size)
- Heap Used
- Heap Total
- External memory

---

## VS Code Debugging

### Launch Configurations

Available in `.vscode/launch.json`:

1. **Debug Server**: Start server with debugger attached
2. **Debug Client**: Debug React application
3. **Debug Full Stack**: Debug both client and server
4. **Debug Tests**: Run tests with debugger

### Breakpoint Debugging

1. Set breakpoints in VS Code (click left of line number)
2. Press `F5` or use Run → Start Debugging
3. Select configuration (e.g., "Debug Server")
4. Application will pause at breakpoints

### Debug Console

Use VS Code's Debug Console to:
- Evaluate expressions
- Inspect variables
- Execute commands
- View call stack

---

## Test Debugging

### Run Tests with Debugging

```bash
# Run with verbose output
npm test -- --verbose

# Run specific test file
npm test -- server/tests/auth.test.ts

# Run with coverage
npm test -- --coverage

# Debug specific test
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

### Jest Debug Configuration

The project includes enhanced Jest configuration for debugging:
- Verbose output
- Source maps enabled
- Clear mocks between tests
- Detailed error messages

### VS Code Test Debugging

1. Open test file
2. Set breakpoint in test
3. Press `F5` and select "Debug Tests"
4. Tests will pause at breakpoints

---

## Troubleshooting

### Common Issues

#### Debug Panel Not Showing

**Problem**: Debug panel button not visible

**Solution**:
1. Ensure `NODE_ENV=development`
2. Check `ENABLE_DEBUG_PANEL=true` in `.env`
3. Clear browser cache and reload

#### Logs Not Appearing

**Problem**: No logs in debug panel

**Solution**:
1. Verify `DEBUG_LEVEL` is set appropriately
2. Check server console for errors
3. Ensure debug routes are registered

#### Database Queries Not Logged

**Problem**: SQL queries not showing in logs

**Solution**:
1. Set `ENABLE_QUERY_LOGGING=true`
2. Set `DEBUG_LEVEL=DEBUG` or higher
3. Restart server after changing environment

#### Performance Issues with Debug Mode

**Problem**: Application slow with debugging enabled

**Solution**:
1. Reduce `DEBUG_LEVEL` to `INFO` or `WARN`
2. Disable `ENABLE_QUERY_LOGGING` if not needed
3. Clear logs periodically (Debug Panel → Logs → Clear)

### Debug Checklist

When debugging issues:

- [ ] Check environment variables are loaded
- [ ] Verify debug level is appropriate
- [ ] Look for errors in server console
- [ ] Check browser console for client errors
- [ ] Review debug panel logs
- [ ] Inspect network requests in browser DevTools
- [ ] Check database connection and queries
- [ ] Verify API endpoints are accessible
- [ ] Test with different debug levels
- [ ] Export and analyze debug logs

---

## Advanced Debugging

### Custom Debug Categories

Create custom categories for specific features:

```typescript
const MY_FEATURE_DEBUG = 'MY_FEATURE';

DebugLogger.debug('Starting process', data, MY_FEATURE_DEBUG);
DebugLogger.info('Process complete', result, MY_FEATURE_DEBUG);
```

### Correlation IDs

Track related operations:

```typescript
const correlationId = generateId();

DebugLogger.info('Request started', req, 'API', correlationId);
// ... process request
DebugLogger.info('Request complete', res, 'API', correlationId);
```

### Conditional Debugging

Enable debugging for specific conditions:

```typescript
if (user.role === 'admin') {
  DebugLogger.setLevel('TRACE');
}
```

### Export Debug Data

Export logs for analysis:

1. Open Debug Panel
2. Go to Logs tab
3. Click Export button (↓)
4. Save JSON file
5. Analyze with tools like `jq` or import to analysis tools

---

## Security Considerations

### Production Safety

- Debug routes are **ONLY** available in development
- Sensitive data is automatically redacted in logs
- Environment variables are sanitized in debug output
- Database credentials are never logged

### Sensitive Data Redaction

The following are automatically redacted:
- Passwords
- API keys
- JWT tokens
- Database URLs
- Session secrets

### Debug in Production

For production debugging:
1. Use structured logging services (e.g., Datadog, New Relic)
2. Implement proper error tracking (e.g., Sentry)
3. Use APM tools for performance monitoring
4. Never expose debug routes in production

---

## Best Practices

1. **Use Appropriate Levels**: Don't use `ERROR` for warnings
2. **Add Categories**: Always categorize logs for filtering
3. **Include Context**: Add relevant data to log entries
4. **Clean Up**: Remove excessive debug logs before committing
5. **Performance**: Disable query logging when not needed
6. **Security**: Never log sensitive information
7. **Correlation**: Use correlation IDs for related operations
8. **Export Regularly**: Export and archive important debug sessions

---

## Quick Reference

### Environment Variables

```bash
# Core Debug Settings
DEBUG_LEVEL=DEBUG                    # ERROR|WARN|INFO|DEBUG|TRACE
ENABLE_DEBUG_PANEL=true              # Show debug UI
ENABLE_API_LOGGING=true              # Log API calls
ENABLE_PERFORMANCE_LOGGING=true      # Track performance
ENABLE_QUERY_LOGGING=true            # Log SQL queries

# Development Tools
REACT_DEVTOOLS=true                  # React DevTools
VITE_DEBUG=true                      # Vite debugging
NODE_OPTIONS=--enable-source-maps    # Source maps

# Test Debugging
TEST_DEBUG=true                      # Verbose tests
TEST_TIMEOUT=30000                   # Test timeout (ms)
```

### NPM Scripts

```bash
npm run dev          # Standard dev mode
npm run dev:debug    # With Node inspector
npm run dev:logs     # With detailed logging
npm run test         # Run tests
npm run test:watch   # Watch mode
```

### Debug Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Shift+D` | Toggle debug panel |
| `F5` | Start VS Code debugging |
| `F9` | Toggle breakpoint |
| `F10` | Step over |
| `F11` | Step into |

---

## Support

For debugging help:
1. Check this documentation
2. Review server console output
3. Inspect browser DevTools
4. Export and share debug logs
5. Check GitHub issues

Remember: **Never commit debug logs or sensitive debug information!**