import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DebugLogger, DEBUG_LEVELS, QueryDebugger, ApiDebugger, PerformanceMonitor } from '../utils/debug';

describe('DebugLogger', () => {
  let consoleSpy: {
    error: jest.SpiedFunction<typeof console.error>;
    warn: jest.SpiedFunction<typeof console.warn>;
    info: jest.SpiedFunction<typeof console.info>;
    log: jest.SpiedFunction<typeof console.log>;
  };

  beforeEach(() => {
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation(),
    };
    DebugLogger.clearLogs();
    // Clear any logs from setLevel calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Log Levels', () => {
    it('should log ERROR level messages', () => {
      DebugLogger.setLevel('ERROR');
      DebugLogger.error('Test error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should log WARN level messages when level is WARN or higher', () => {
      DebugLogger.setLevel('WARN');
      DebugLogger.warn('Test warning');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should not log DEBUG messages when level is INFO', () => {
      DebugLogger.setLevel('INFO');
      DebugLogger.debug('Test debug');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should log all levels when set to TRACE', () => {
      DebugLogger.setLevel('TRACE');
      jest.clearAllMocks(); // Clear the setLevel log
      
      DebugLogger.error('Error');
      DebugLogger.warn('Warning');
      DebugLogger.info('Info');
      DebugLogger.debug('Debug');
      DebugLogger.trace('Trace');
      
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledTimes(2); // debug + trace
    });
  });

  describe('Log Storage', () => {
    it('should store logs in memory', () => {
      DebugLogger.setLevel('DEBUG');
      DebugLogger.clearLogs(); // Clear any setLevel logs
      DebugLogger.info('Test message', { data: 'test' }, 'TEST_CATEGORY');
      
      const logs = DebugLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        level: 'INFO',
        message: 'Test message',
        category: 'TEST_CATEGORY',
        data: { data: 'test' }
      });
    });

    it('should filter logs by level', () => {
      DebugLogger.setLevel('DEBUG');
      DebugLogger.error('Error message');
      DebugLogger.info('Info message');
      
      const errorLogs = DebugLogger.getLogs({ level: 'ERROR' });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe('ERROR');
    });

    it('should filter logs by category', () => {
      DebugLogger.setLevel('DEBUG');
      DebugLogger.info('Message 1', null, 'CAT_A');
      DebugLogger.info('Message 2', null, 'CAT_B');
      
      const catALogs = DebugLogger.getLogs({ category: 'CAT_A' });
      expect(catALogs).toHaveLength(1);
      expect(catALogs[0].category).toBe('CAT_A');
    });

    it('should limit returned logs', () => {
      DebugLogger.setLevel('DEBUG');
      for (let i = 0; i < 10; i++) {
        DebugLogger.info(`Message ${i}`);
      }
      
      const limitedLogs = DebugLogger.getLogs({ limit: 5 });
      expect(limitedLogs).toHaveLength(5);
    });
  });

  describe('Categories', () => {
    it('should track unique categories', () => {
      DebugLogger.setLevel('DEBUG');
      DebugLogger.clearLogs(); // Clear any existing logs and categories
      DebugLogger.info('Message', null, 'CAT_A');
      DebugLogger.info('Message', null, 'CAT_B');
      DebugLogger.info('Message', null, 'CAT_A'); // Duplicate
      
      const categories = DebugLogger.getCategories();
      expect(categories).toContain('CAT_A');
      expect(categories).toContain('CAT_B');
      // Categories might include others from setLevel, so check minimum
      expect(categories.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Clear Logs', () => {
    it('should clear all stored logs', () => {
      DebugLogger.setLevel('DEBUG');
      DebugLogger.clearLogs(); // Clear setLevel log
      DebugLogger.info('Message 1');
      DebugLogger.info('Message 2');
      
      expect(DebugLogger.getLogs()).toHaveLength(2);
      
      DebugLogger.clearLogs();
      expect(DebugLogger.getLogs()).toHaveLength(0);
    });
  });
});

describe('QueryDebugger', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    DebugLogger.setLevel('DEBUG');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log queries when debug level is DEBUG', () => {
    QueryDebugger.logQuery('SELECT * FROM users', ['param1'], 100);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should not log queries when debug level is INFO', () => {
    DebugLogger.setLevel('INFO');
    QueryDebugger.logQuery('SELECT * FROM users', ['param1'], 100);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log query errors', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    QueryDebugger.logError('SELECT * FROM invalid', new Error('Table not found'));
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('ApiDebugger', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    DebugLogger.setLevel('DEBUG');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log API requests', () => {
    ApiDebugger.logRequest('GET', '/api/users', null, { 'Content-Type': 'application/json' });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log API responses with appropriate level', () => {
    ApiDebugger.logResponse('GET', '/api/users', 200, 50, { users: [] });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should use ERROR level for 4xx and 5xx responses', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    ApiDebugger.logResponse('GET', '/api/users', 404, 10, { error: 'Not found' });
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    DebugLogger.setLevel('DEBUG');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should measure synchronous operations', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    PerformanceMonitor.start('test-operation');
    jest.advanceTimersByTime(100);
    const duration = PerformanceMonitor.end('test-operation');
    
    expect(duration).toBe(100);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should measure with helper function', () => {
    const result = PerformanceMonitor.measure('test-operation', () => {
      return 'test-result';
    });
    
    expect(result).toBe('test-result');
  });

  it('should measure async operations', async () => {
    jest.useRealTimers(); // Need real timers for async
    
    const result = await PerformanceMonitor.measureAsync('async-operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'async-result';
    });
    
    expect(result).toBe('async-result');
  });

  it('should handle missing timer gracefully', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const duration = PerformanceMonitor.end('non-existent');
    
    expect(duration).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });
});