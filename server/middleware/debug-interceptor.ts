import { Request, Response, NextFunction } from 'express';
import { DebugLogger, apiDebug } from '../utils/debug.js';
import { debugWebSocket } from '../services/debug-websocket.js';
import { debugRecorder } from '../services/debug-recorder.js';
import { v4 as uuidv4 } from 'uuid';

interface InterceptedRequest {
  id: string;
  method: string;
  path: string;
  query: any;
  body: any;
  headers: any;
  timestamp: string;
}

interface InterceptedResponse {
  requestId: string;
  status: number;
  headers: any;
  body: any;
  duration: number;
  timestamp: string;
}

export class NetworkInterceptor {
  private static requests = new Map<string, InterceptedRequest>();
  private static responses = new Map<string, InterceptedResponse>();
  private static maxStoredRequests = 100;

  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (process.env.NODE_ENV === 'production' || process.env.ENABLE_NETWORK_LOGGING !== 'true') {
        return next();
      }

      const requestId = uuidv4();
      const startTime = Date.now();

      // Capture request details
      const interceptedRequest: InterceptedRequest = {
        id: requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        body: this.sanitizeBody(req.body),
        headers: this.sanitizeHeaders(req.headers),
        timestamp: new Date().toISOString()
      };

      // Store request
      this.requests.set(requestId, interceptedRequest);
      
      // Cleanup old requests
      if (this.requests.size > this.maxStoredRequests) {
        const oldestKey = this.requests.keys().next().value;
        this.requests.delete(oldestKey);
        this.responses.delete(oldestKey);
      }

      // Log request
      apiDebug.logRequest(req.method, req.path, interceptedRequest.body, interceptedRequest.headers);

      // Broadcast via WebSocket
      debugWebSocket.broadcastNetworkRequest({
        type: 'request',
        ...interceptedRequest
      });

      // Add to recording session
      debugRecorder.addNetworkRequest({
        type: 'request',
        ...interceptedRequest
      });

      // Store request ID in res.locals for response tracking
      res.locals.debugRequestId = requestId;
      res.locals.debugStartTime = startTime;

      // Intercept response
      const originalSend = res.send;
      const originalJson = res.json;
      const originalStatus = res.status;

      let responseStatus = 200;

      res.status = function(code: number) {
        responseStatus = code;
        return originalStatus.call(this, code);
      };

      res.send = function(body: any) {
        responseBody = body;
        NetworkInterceptor.captureResponse(requestId, responseStatus, body, res.getHeaders(), startTime);
        return originalSend.call(this, body);
      };

      res.json = function(body: any) {
        responseBody = body;
        NetworkInterceptor.captureResponse(requestId, responseStatus, body, res.getHeaders(), startTime);
        return originalJson.call(this, body);
      };

      next();
    };
  }

  private static captureResponse(
    requestId: string,
    status: number,
    body: any,
    headers: any,
    startTime: number
  ) {
    const duration = Date.now() - startTime;
    
    const interceptedResponse: InterceptedResponse = {
      requestId,
      status,
      headers: this.sanitizeHeaders(headers),
      body: this.sanitizeBody(body),
      duration,
      timestamp: new Date().toISOString()
    };

    // Store response
    this.responses.set(requestId, interceptedResponse);

    // Get original request
    const request = this.requests.get(requestId);
    if (request) {
      // Log response
      apiDebug.logResponse(request.method, request.path, status, duration, interceptedResponse.body);

      // Broadcast via WebSocket
      debugWebSocket.broadcastNetworkRequest({
        type: 'response',
        ...interceptedResponse,
        request
      });

      // Add to recording session
      debugRecorder.addNetworkRequest({
        type: 'response',
        ...interceptedResponse,
        request
      });

      // Check for slow requests
      if (duration > 1000) {
        DebugLogger.warn(`Slow request detected: ${request.method} ${request.path} took ${duration}ms`, 
          { request, response: interceptedResponse }, 'PERFORMANCE');
      }
    }
  }

  private static sanitizeHeaders(headers: any): any {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-auth-token',
      'x-api-key',
      'x-csrf-token'
    ];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  private static sanitizeBody(body: any): any {
    if (!body) return body;
    if (typeof body !== 'object') return body;

    const sanitized = JSON.parse(JSON.stringify(body));
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn'
    ];

    const sanitizeObject = (obj: any) => {
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  static getRequests(limit = 50): InterceptedRequest[] {
    return Array.from(this.requests.values()).slice(-limit);
  }

  static getResponses(limit = 50): InterceptedResponse[] {
    return Array.from(this.responses.values()).slice(-limit);
  }

  static getRequestById(id: string): { request?: InterceptedRequest; response?: InterceptedResponse } {
    return {
      request: this.requests.get(id),
      response: this.responses.get(id)
    };
  }

  static clear() {
    this.requests.clear();
    this.responses.clear();
    DebugLogger.info('Network interceptor cache cleared', undefined, 'NETWORK');
  }

  static getStats() {
    const requests = Array.from(this.requests.values());
    const responses = Array.from(this.responses.values());

    const methodCounts = requests.reduce((acc, req) => {
      acc[req.method] = (acc[req.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusCounts = responses.reduce((acc, res) => {
      const statusGroup = `${Math.floor(res.status / 100)}xx`;
      acc[statusGroup] = (acc[statusGroup] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgDuration = responses.length > 0
      ? responses.reduce((sum, res) => sum + res.duration, 0) / responses.length
      : 0;

    const slowestRequests = responses
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .map(res => {
        const req = this.requests.get(res.requestId);
        return {
          method: req?.method,
          path: req?.path,
          duration: res.duration,
          status: res.status
        };
      });

    return {
      totalRequests: requests.length,
      totalResponses: responses.length,
      methodCounts,
      statusCounts,
      avgDuration: Math.round(avgDuration),
      slowestRequests
    };
  }
}

// Middleware for browser DevTools integration
export function devToolsIntegration() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'production') {
      return next();
    }

    // Add Chrome DevTools Protocol headers
    res.setHeader('X-Debug-Request-Id', res.locals.debugRequestId || 'unknown');
    res.setHeader('X-Debug-Timing', Date.now().toString());

    // Enable source maps
    if (req.path.endsWith('.js')) {
      res.setHeader('SourceMap', req.path + '.map');
    }

    // Add Server-Timing header for performance insights
    const serverTiming = [];
    
    // Add timing metrics as we process the request
    res.on('finish', () => {
      if (res.locals.debugStartTime) {
        const duration = Date.now() - res.locals.debugStartTime;
        serverTiming.push(`total;dur=${duration}`);
        
        // Add any other timing metrics collected during request
        if (res.locals.dbQueryTime) {
          serverTiming.push(`db;dur=${res.locals.dbQueryTime}`);
        }
        
        if (res.locals.cacheTime) {
          serverTiming.push(`cache;dur=${res.locals.cacheTime}`);
        }

        res.setHeader('Server-Timing', serverTiming.join(', '));
      }
    });

    next();
  };
}

// Export convenience middleware
export const networkInterceptor = NetworkInterceptor.middleware();
export const getNetworkStats = () => NetworkInterceptor.getStats();
export const getNetworkRequests = (limit?: number) => NetworkInterceptor.getRequests(limit);
export const getNetworkResponses = (limit?: number) => NetworkInterceptor.getResponses(limit);