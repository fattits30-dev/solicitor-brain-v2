import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { DebugLogger, DEBUG_LEVELS } from '../utils/debug.js';
import { EventEmitter } from 'events';

interface DebugClient {
  id: string;
  ws: WebSocket;
  filters: {
    level?: keyof typeof DEBUG_LEVELS;
    categories?: string[];
  };
  subscriptions: Set<string>;
}

export class DebugWebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, DebugClient> = new Map();
  private logBuffer: any[] = [];
  private maxBufferSize = 1000;
  private isRecording = false;
  private recordingSession: any = null;

  initialize(server: Server) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    this.wss = new WebSocketServer({ 
      server,
      path: '/debug-ws'
    });

    this.wss.on('connection', (ws, _req) => {
      const clientId = this.generateClientId();
      const client: DebugClient = {
        id: clientId,
        ws,
        filters: {},
        subscriptions: new Set(['logs', 'metrics', 'queries'])
      };

      this.clients.set(clientId, client);
      DebugLogger.info(`Debug WebSocket client connected: ${clientId}`, undefined, 'WEBSOCKET');

      // Send initial connection message
      this.sendToClient(client, {
        type: 'connection',
        clientId,
        timestamp: new Date().toISOString()
      });

      // Send buffered logs
      this.sendBufferedLogs(client);

      // Handle client messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(client, message);
        } catch (error) {
          DebugLogger.error('Invalid WebSocket message', error, 'WEBSOCKET');
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        this.clients.delete(clientId);
        DebugLogger.info(`Debug WebSocket client disconnected: ${clientId}`, undefined, 'WEBSOCKET');
      });

      ws.on('error', (error) => {
        DebugLogger.error(`WebSocket error for client ${clientId}`, error, 'WEBSOCKET');
      });
    });

    // Subscribe to debug events
    this.subscribeToDebugEvents();
    
    DebugLogger.info('Debug WebSocket service initialized', undefined, 'WEBSOCKET');
  }

  private generateClientId(): string {
    return `debug-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private subscribeToDebugEvents() {
    // Hook into DebugLogger to capture all logs
    const originalLog = DebugLogger.log;
    const self = this;
    
    (DebugLogger as any).log = function(level: any, message: string, data?: any, category?: string, correlationId?: string) {
      // Call original log function
      originalLog.call(this, level, message, data, category, correlationId);
      
      // Broadcast to WebSocket clients
      const logEntry = {
        type: 'log',
        level,
        message,
        data,
        category,
        correlationId,
        timestamp: new Date().toISOString()
      };

      self.broadcastLog(logEntry);
      self.addToBuffer(logEntry);

      // Record if session is active
      if (self.isRecording && self.recordingSession) {
        self.recordingSession.logs.push(logEntry);
      }
    };
  }

  private handleClientMessage(client: DebugClient, message: any) {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(client, message);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(client, message);
        break;
      case 'setFilters':
        this.handleSetFilters(client, message);
        break;
      case 'getBuffer':
        this.sendBufferedLogs(client);
        break;
      case 'clearBuffer':
        this.clearBuffer();
        break;
      case 'startRecording':
        this.startRecording(client);
        break;
      case 'stopRecording':
        this.stopRecording(client);
        break;
      case 'ping':
        this.sendToClient(client, { type: 'pong', timestamp: new Date().toISOString() });
        break;
      default:
        DebugLogger.warn(`Unknown WebSocket message type: ${message.type}`, undefined, 'WEBSOCKET');
    }
  }

  private handleSubscribe(client: DebugClient, message: any) {
    const { channels = [] } = message;
    channels.forEach((channel: string) => {
      client.subscriptions.add(channel);
    });
    
    this.sendToClient(client, {
      type: 'subscribed',
      channels,
      timestamp: new Date().toISOString()
    });
  }

  private handleUnsubscribe(client: DebugClient, message: any) {
    const { channels = [] } = message;
    channels.forEach((channel: string) => {
      client.subscriptions.delete(channel);
    });
    
    this.sendToClient(client, {
      type: 'unsubscribed',
      channels,
      timestamp: new Date().toISOString()
    });
  }

  private handleSetFilters(client: DebugClient, message: any) {
    const { level, categories } = message;
    
    if (level) {
      client.filters.level = level;
    }
    
    if (categories) {
      client.filters.categories = categories;
    }
    
    this.sendToClient(client, {
      type: 'filtersUpdated',
      filters: client.filters,
      timestamp: new Date().toISOString()
    });
  }

  private sendBufferedLogs(client: DebugClient) {
    const filteredLogs = this.filterLogsForClient(client, this.logBuffer);
    
    this.sendToClient(client, {
      type: 'buffer',
      logs: filteredLogs,
      timestamp: new Date().toISOString()
    });
  }

  private filterLogsForClient(client: DebugClient, logs: any[]): any[] {
    return logs.filter(log => {
      // Check subscription
      if (!client.subscriptions.has('logs')) {
        return false;
      }

      // Check level filter
      if (client.filters.level && DEBUG_LEVELS[log.level] > DEBUG_LEVELS[client.filters.level]) {
        return false;
      }

      // Check category filter
      if (client.filters.categories && client.filters.categories.length > 0) {
        if (!log.category || !client.filters.categories.includes(log.category)) {
          return false;
        }
      }

      return true;
    });
  }

  private broadcastLog(logEntry: any) {
    this.clients.forEach(client => {
      if (client.subscriptions.has('logs')) {
        const filtered = this.filterLogsForClient(client, [logEntry]);
        if (filtered.length > 0) {
          this.sendToClient(client, logEntry);
        }
      }
    });
  }

  private sendToClient(client: DebugClient, data: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(data));
      } catch (error) {
        DebugLogger.error(`Failed to send to client ${client.id}`, error, 'WEBSOCKET');
      }
    }
  }

  broadcastMetrics(metrics: any) {
    const message = {
      type: 'metrics',
      data: metrics,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(client => {
      if (client.subscriptions.has('metrics')) {
        this.sendToClient(client, message);
      }
    });

    if (this.isRecording && this.recordingSession) {
      this.recordingSession.metrics.push(message);
    }
  }

  broadcastQuery(query: any) {
    const message = {
      type: 'query',
      data: query,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(client => {
      if (client.subscriptions.has('queries')) {
        this.sendToClient(client, message);
      }
    });

    if (this.isRecording && this.recordingSession) {
      this.recordingSession.queries.push(message);
    }
  }

  broadcastNetworkRequest(request: any) {
    const message = {
      type: 'network',
      data: request,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(client => {
      if (client.subscriptions.has('network')) {
        this.sendToClient(client, message);
      }
    });

    if (this.isRecording && this.recordingSession) {
      this.recordingSession.network.push(message);
    }
  }

  private addToBuffer(entry: any) {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  private clearBuffer() {
    this.logBuffer = [];
    
    const message = {
      type: 'bufferCleared',
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  // Session Recording
  private startRecording(client: DebugClient) {
    if (this.isRecording) {
      this.sendToClient(client, {
        type: 'error',
        message: 'Recording already in progress',
        timestamp: new Date().toISOString()
      });
      return;
    }

    this.isRecording = true;
    this.recordingSession = {
      id: `session-${Date.now()}`,
      startTime: new Date().toISOString(),
      logs: [],
      metrics: [],
      queries: [],
      network: [],
      events: []
    };

    const message = {
      type: 'recordingStarted',
      sessionId: this.recordingSession.id,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(c => {
      this.sendToClient(c, message);
    });

    DebugLogger.info(`Started recording session: ${this.recordingSession.id}`, undefined, 'RECORDING');
  }

  private stopRecording(client: DebugClient) {
    if (!this.isRecording || !this.recordingSession) {
      this.sendToClient(client, {
        type: 'error',
        message: 'No recording in progress',
        timestamp: new Date().toISOString()
      });
      return;
    }

    this.recordingSession.endTime = new Date().toISOString();
    const session = { ...this.recordingSession };
    
    this.isRecording = false;
    this.recordingSession = null;

    const message = {
      type: 'recordingStopped',
      session,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(c => {
      this.sendToClient(c, message);
    });

    DebugLogger.info(`Stopped recording session: ${session.id}`, 
      { 
        logs: session.logs.length,
        metrics: session.metrics.length,
        queries: session.queries.length,
        network: session.network.length
      }, 
      'RECORDING'
    );

    return session;
  }

  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      sessionId: this.recordingSession?.id,
      startTime: this.recordingSession?.startTime
    };
  }

  shutdown() {
    if (this.wss) {
      this.clients.forEach(client => {
        client.ws.close();
      });
      this.wss.close();
      DebugLogger.info('Debug WebSocket service shut down', undefined, 'WEBSOCKET');
    }
  }
}

// Export singleton instance
export const debugWebSocket = new DebugWebSocketService();