import { Router, Request, Response } from 'express';
import { db } from '../db';
import { DebugLogger, perfMonitor } from '../utils/debug';
import { DebugPresetManager, getPresets, getActivePreset } from '../utils/debug-presets';
import { debugRecorder } from '../services/debug-recorder';
import { debugWebSocket } from '../services/debug-websocket';
import { getNetworkStats, getNetworkRequests, getNetworkResponses } from '../middleware/debug-interceptor';
import os from 'os';
import { users, cases, documents, persons } from '../../shared/schema';
import { sql } from 'drizzle-orm';

const router = Router();

// Only enable debug routes in development
if (process.env.NODE_ENV !== 'production') {
  DebugLogger.info('Debug routes enabled', undefined, 'DEBUG_ROUTES');

  // Health check endpoint
  router.get('/health', async (req: Request, res: Response) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      system: {
        platform: os.platform(),
        release: os.release(),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        cpus: os.cpus().length,
      },
    };

    try {
      // Test database connection
      await perfMonitor.measureAsync('database_health_check', async () => {
        await db.execute(sql`SELECT 1 as test`);
      });
      
      res.json({ ...health, database: 'connected' });
    } catch (error) {
      DebugLogger.error('Database health check failed', error, 'DEBUG_ROUTES');
      res.status(503).json({ ...health, database: 'disconnected', error: error.message });
    }
  });

  // Environment variables (sanitized)
  router.get('/env', (req: Request, res: Response) => {
    const safeEnv: Record<string, string | undefined> = {};
    const sensitiveKeys = [
      'DATABASE_URL',
      'JWT_SECRET',
      'REDIS_URL',
      'SESSION_SECRET',
      'GITHUB_TOKEN',
      'API_KEY',
      'SECRET',
      'PASSWORD',
      'TOKEN',
    ];

    for (const [key, value] of Object.entries(process.env)) {
      if (sensitiveKeys.some(sensitive => key.includes(sensitive))) {
        safeEnv[key] = value ? '***REDACTED***' : undefined;
      } else {
        safeEnv[key] = value;
      }
    }

    res.json(safeEnv);
  });

  // Database statistics
  router.get('/db-stats', async (req: Request, res: Response) => {
    try {
      const stats = await perfMonitor.measureAsync('database_stats', async () => {
        const [userCount] = await db.select({ count: sql`count(*)` }).from(users);
        const [caseCount] = await db.select({ count: sql`count(*)` }).from(cases);
        const [documentCount] = await db.select({ count: sql`count(*)` }).from(documents);
        const [personCount] = await db.select({ count: sql`count(*)` }).from(persons);

        return {
          users: userCount.count,
          cases: caseCount.count,
          documents: documentCount.count,
          persons: personCount.count,
        };
      });

      res.json(stats);
    } catch (error) {
      DebugLogger.error('Failed to get database stats', error, 'DEBUG_ROUTES');
      res.status(500).json({ error: 'Failed to get database stats' });
    }
  });

  // Get debug logs
  router.get('/logs', (req: Request, res: Response) => {
    const { level, category, limit } = req.query;
    
    const logs = DebugLogger.getLogs({
      level: level as any,
      category: category as string,
      limit: limit ? parseInt(limit as string) : 100,
    });

    res.json({
      logs,
      categories: DebugLogger.getCategories(),
      currentLevel: DebugLogger.getLevel(),
    });
  });

  // Set debug level
  router.post('/level', (req: Request, res: Response) => {
    const { level } = req.body;
    
    if (!level || !['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].includes(level)) {
      return res.status(400).json({ error: 'Invalid debug level' });
    }

    DebugLogger.setLevel(level);
    res.json({ level: DebugLogger.getLevel() });
  });

  // Clear debug logs
  router.delete('/logs', (req: Request, res: Response) => {
    DebugLogger.clearLogs();
    res.json({ message: 'Logs cleared' });
  });

  // Performance metrics
  router.get('/performance', (req: Request, res: Response) => {
    const metrics = {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      pid: process.pid,
    };

    res.json(metrics);
  });

  // Test error handling
  router.get('/error-test', (req: Request, res: Response) => {
    const { type } = req.query;

    switch (type) {
      case 'sync':
        throw new Error('Test synchronous error');
      case 'async':
        setTimeout(() => {
          throw new Error('Test asynchronous error');
        }, 0);
        res.json({ message: 'Async error triggered' });
        break;
      case 'rejection':
        Promise.reject(new Error('Test unhandled rejection'));
        res.json({ message: 'Unhandled rejection triggered' });
        break;
      default:
        res.status(400).json({ error: 'Invalid error type. Use: sync, async, or rejection' });
    }
  });

  // Routes information
  router.get('/routes', (req: Request, res: Response) => {
    const routes: any[] = [];
    
    const extractRoutes = (stack: any[], basePath = '') => {
      stack.forEach(layer => {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
          routes.push({
            path: basePath + layer.route.path,
            methods,
          });
        } else if (layer.name === 'router' && layer.handle.stack) {
          extractRoutes(layer.handle.stack, basePath + (layer.regexp.source.match(/\/\w+/) || [''])[0]);
        }
      });
    };

    if (req.app._router && req.app._router.stack) {
      extractRoutes(req.app._router.stack);
    }

    res.json({ routes: routes.sort((a, b) => a.path.localeCompare(b.path)) });
  });

  // Session info (if using sessions)
  router.get('/session', (req: Request, res: Response) => {
    if (!req.session) {
      return res.json({ message: 'No session configured' });
    }

    res.json({
      sessionId: req.sessionID,
      session: req.session,
      cookie: req.session.cookie,
    });
  });

  // Cache stats (if using Redis)
  router.get('/cache', async (req: Request, res: Response) => {
    try {
      // This would connect to Redis if configured
      res.json({ 
        message: 'Cache stats would go here if Redis is configured',
        redisUrl: process.env.REDIS_URL ? 'Configured' : 'Not configured',
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get cache stats' });
    }
  });

  // Debug presets
  router.get('/presets', (req: Request, res: Response) => {
    res.json({
      presets: getPresets(),
      active: getActivePreset()
    });
  });

  router.post('/presets/:id/activate', (req: Request, res: Response) => {
    const { id } = req.params;
    const success = DebugPresetManager.activate(id);
    
    if (success) {
      res.json({ 
        message: `Preset ${id} activated`,
        preset: DebugPresetManager.getPreset(id)
      });
    } else {
      res.status(400).json({ error: `Preset ${id} not found` });
    }
  });

  router.post('/presets/deactivate', (req: Request, res: Response) => {
    DebugPresetManager.deactivate();
    res.json({ message: 'Debug preset deactivated' });
  });

  // Recording sessions
  router.get('/recording', (req: Request, res: Response) => {
    res.json(debugRecorder.getStatus());
  });

  router.post('/recording/start', async (req: Request, res: Response) => {
    const { name, description } = req.body;
    
    try {
      const sessionId = await debugRecorder.startSession(name, description);
      res.json({ sessionId, message: 'Recording started' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/recording/stop', async (req: Request, res: Response) => {
    const session = await debugRecorder.stopSession();
    
    if (session) {
      res.json({ session, message: 'Recording stopped' });
    } else {
      res.status(400).json({ error: 'No recording in progress' });
    }
  });

  router.get('/recording/sessions', async (req: Request, res: Response) => {
    const sessions = await debugRecorder.listSessions();
    res.json({ sessions });
  });

  router.get('/recording/sessions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const session = await debugRecorder.loadSession(id);
    
    if (session) {
      res.json(session);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  router.delete('/recording/sessions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const success = await debugRecorder.deleteSession(id);
    
    if (success) {
      res.json({ message: 'Session deleted' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  router.get('/recording/sessions/:id/export', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    
    const exported = await debugRecorder.exportSession(id, format as 'json' | 'html');
    
    if (exported) {
      if (format === 'html') {
        res.setHeader('Content-Type', 'text/html');
      } else {
        res.setHeader('Content-Type', 'application/json');
      }
      res.send(exported);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  // Network interception
  router.get('/network', (req: Request, res: Response) => {
    const { limit = 50 } = req.query;
    
    res.json({
      stats: getNetworkStats(),
      requests: getNetworkRequests(Number(limit)),
      responses: getNetworkResponses(Number(limit))
    });
  });

  router.get('/network/stats', (req: Request, res: Response) => {
    res.json(getNetworkStats());
  });

  router.get('/network/requests', (req: Request, res: Response) => {
    const { limit = 50 } = req.query;
    res.json(getNetworkRequests(Number(limit)));
  });

  router.get('/network/responses', (req: Request, res: Response) => {
    const { limit = 50 } = req.query;
    res.json(getNetworkResponses(Number(limit)));
  });

  DebugLogger.info('Debug routes initialized', { 
    endpoints: [
      '/api/debug/health',
      '/api/debug/env',
      '/api/debug/db-stats',
      '/api/debug/logs',
      '/api/debug/level',
      '/api/debug/performance',
      '/api/debug/error-test',
      '/api/debug/routes',
      '/api/debug/session',
      '/api/debug/cache',
    ]
  }, 'DEBUG_ROUTES');
}

export default router;