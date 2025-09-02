import fs from 'fs/promises';
import path from 'path';
import { DebugLogger } from '../utils/debug.js';

export interface DebugSession {
  id: string;
  name?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  logs: any[];
  metrics: any[];
  queries: any[];
  network: any[];
  events: any[];
  metadata?: Record<string, any>;
}

export class DebugRecorder {
  private sessionsDir: string;
  private currentSession: DebugSession | null = null;
  private isRecording = false;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.sessionsDir = path.join(process.cwd(), '.debug-sessions');
    this.ensureSessionsDirectory();
  }

  private async ensureSessionsDirectory() {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    } catch (error) {
      DebugLogger.error('Failed to create sessions directory', error, 'RECORDER');
    }
  }

  async startSession(name?: string, description?: string): Promise<string> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    const sessionId = `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      name: name || `Session ${new Date().toLocaleString()}`,
      description,
      startTime: new Date().toISOString(),
      logs: [],
      metrics: [],
      queries: [],
      network: [],
      events: [],
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV,
        debugLevel: process.env.DEBUG_LEVEL
      }
    };

    this.isRecording = true;

    // Auto-save every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveSession();
    }, 30000);

    DebugLogger.info(`Started debug recording session: ${sessionId}`, { name, description }, 'RECORDER');
    
    return sessionId;
  }

  async stopSession(): Promise<DebugSession | null> {
    if (!this.isRecording || !this.currentSession) {
      return null;
    }

    this.currentSession.endTime = new Date().toISOString();
    
    // Clear auto-save
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    // Save final session
    await this.saveSession();
    
    const session = { ...this.currentSession };
    this.currentSession = null;
    this.isRecording = false;

    DebugLogger.info(`Stopped debug recording session: ${session.id}`, {
      duration: this.calculateDuration(session.startTime, session.endTime),
      logs: session.logs.length,
      metrics: session.metrics.length,
      queries: session.queries.length,
      network: session.network.length
    }, 'RECORDER');

    return session;
  }

  addLog(entry: any) {
    if (this.isRecording && this.currentSession) {
      this.currentSession.logs.push({
        ...entry,
        timestamp: new Date().toISOString()
      });
    }
  }

  addMetric(metric: any) {
    if (this.isRecording && this.currentSession) {
      this.currentSession.metrics.push({
        ...metric,
        timestamp: new Date().toISOString()
      });
    }
  }

  addQuery(query: any) {
    if (this.isRecording && this.currentSession) {
      this.currentSession.queries.push({
        ...query,
        timestamp: new Date().toISOString()
      });
    }
  }

  addNetworkRequest(request: any) {
    if (this.isRecording && this.currentSession) {
      this.currentSession.network.push({
        ...request,
        timestamp: new Date().toISOString()
      });
    }
  }

  addEvent(event: any) {
    if (this.isRecording && this.currentSession) {
      this.currentSession.events.push({
        ...event,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.currentSession) return;

    const filename = `${this.currentSession.id}.json`;
    const filepath = path.join(this.sessionsDir, filename);

    try {
      await fs.writeFile(filepath, JSON.stringify(this.currentSession, null, 2));
      DebugLogger.debug(`Saved session to ${filepath}`, undefined, 'RECORDER');
    } catch (error) {
      DebugLogger.error('Failed to save session', error, 'RECORDER');
    }
  }

  async loadSession(sessionId: string): Promise<DebugSession | null> {
    const filename = `${sessionId}.json`;
    const filepath = path.join(this.sessionsDir, filename);

    try {
      const data = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      DebugLogger.error(`Failed to load session ${sessionId}`, error, 'RECORDER');
      return null;
    }
  }

  async listSessions(): Promise<Array<{ id: string; name: string; startTime: string; endTime?: string }>> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.sessionsDir, file);
          try {
            const data = await fs.readFile(filepath, 'utf-8');
            const session = JSON.parse(data);
            sessions.push({
              id: session.id,
              name: session.name,
              startTime: session.startTime,
              endTime: session.endTime
            });
          } catch (error) {
            DebugLogger.warn(`Failed to read session file ${file}`, error, 'RECORDER');
          }
        }
      }

      return sessions.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    } catch (error) {
      DebugLogger.error('Failed to list sessions', error, 'RECORDER');
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const filename = `${sessionId}.json`;
    const filepath = path.join(this.sessionsDir, filename);

    try {
      await fs.unlink(filepath);
      DebugLogger.info(`Deleted session ${sessionId}`, undefined, 'RECORDER');
      return true;
    } catch (error) {
      DebugLogger.error(`Failed to delete session ${sessionId}`, error, 'RECORDER');
      return false;
    }
  }

  async exportSession(sessionId: string, format: 'json' | 'html' = 'json'): Promise<string | null> {
    const session = await this.loadSession(sessionId);
    if (!session) return null;

    if (format === 'json') {
      return JSON.stringify(session, null, 2);
    } else if (format === 'html') {
      return this.generateHTMLReport(session);
    }

    return null;
  }

  private generateHTMLReport(session: DebugSession): string {
    const duration = this.calculateDuration(session.startTime, session.endTime);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Debug Session Report - ${session.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    h1, h2 { color: #333; }
    .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .section { margin: 20px 0; }
    .log-entry { padding: 5px; margin: 2px 0; font-family: monospace; font-size: 12px; }
    .log-ERROR { background: #fee; color: #c00; }
    .log-WARN { background: #ffa; color: #660; }
    .log-INFO { background: #e6f3ff; color: #036; }
    .log-DEBUG { background: #efe; color: #060; }
    .log-TRACE { background: #f9f9f9; color: #666; }
    .query { background: #f0f8ff; padding: 10px; margin: 5px 0; border-left: 3px solid #0066cc; }
    .metric { background: #fff8f0; padding: 10px; margin: 5px 0; border-left: 3px solid #ff6600; }
    .network { background: #f0fff0; padding: 10px; margin: 5px 0; border-left: 3px solid #00cc00; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
    .stats { display: flex; gap: 20px; }
    .stat-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
    .stat-label { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Debug Session Report</h1>
  
  <div class="metadata">
    <h2>${session.name}</h2>
    ${session.description ? `<p>${session.description}</p>` : ''}
    <p><strong>Session ID:</strong> ${session.id}</p>
    <p><strong>Start Time:</strong> ${new Date(session.startTime).toLocaleString()}</p>
    <p><strong>End Time:</strong> ${session.endTime ? new Date(session.endTime).toLocaleString() : 'In Progress'}</p>
    <p><strong>Duration:</strong> ${duration}</p>
    <p><strong>Environment:</strong> ${session.metadata?.environment || 'N/A'}</p>
    <p><strong>Debug Level:</strong> ${session.metadata?.debugLevel || 'N/A'}</p>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${session.logs.length}</div>
      <div class="stat-label">Log Entries</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${session.queries.length}</div>
      <div class="stat-label">Database Queries</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${session.network.length}</div>
      <div class="stat-label">Network Requests</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${session.metrics.length}</div>
      <div class="stat-label">Metrics</div>
    </div>
  </div>

  <div class="section">
    <h2>Logs</h2>
    ${session.logs.slice(-100).map(log => `
      <div class="log-entry log-${log.level}">
        <strong>[${log.level}]</strong> ${new Date(log.timestamp).toLocaleTimeString()} 
        ${log.category ? `[${log.category}]` : ''} ${log.message}
        ${log.data ? `<pre>${JSON.stringify(log.data, null, 2)}</pre>` : ''}
      </div>
    `).join('')}
  </div>

  <div class="section">
    <h2>Database Queries</h2>
    ${session.queries.slice(-50).map(query => `
      <div class="query">
        <strong>${query.timestamp}</strong> - ${query.duration}ms
        <pre>${query.query}</pre>
        ${query.params ? `<pre>Params: ${JSON.stringify(query.params)}</pre>` : ''}
      </div>
    `).join('')}
  </div>

  <div class="section">
    <h2>Network Requests</h2>
    ${session.network.slice(-50).map(req => `
      <div class="network">
        <strong>${req.method} ${req.path}</strong> - ${req.status} (${req.duration}ms)
        ${req.error ? `<pre>Error: ${req.error}</pre>` : ''}
      </div>
    `).join('')}
  </div>

  <script>
    // Add interactive features here if needed
    console.log('Debug session loaded:', ${JSON.stringify(session.id)});
  </script>
</body>
</html>
    `;
  }

  private calculateDuration(startTime: string, endTime?: string): string {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const duration = end - start;

    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getStatus() {
    return {
      isRecording: this.isRecording,
      sessionId: this.currentSession?.id,
      sessionName: this.currentSession?.name,
      startTime: this.currentSession?.startTime,
      stats: this.currentSession ? {
        logs: this.currentSession.logs.length,
        metrics: this.currentSession.metrics.length,
        queries: this.currentSession.queries.length,
        network: this.currentSession.network.length,
        events: this.currentSession.events.length
      } : null
    };
  }
}

// Export singleton instance
export const debugRecorder = new DebugRecorder();