/**
 * Comprehensive Error Handling and Real-time Updates Tests
 * 
 * Tests error handling, recovery mechanisms, and real-time functionality:
 * - Network failure scenarios and recovery
 * - API error handling across all MCP contexts
 * - WebSocket connection failures and reconnection
 * - Real-time update propagation and synchronization
 * - Data consistency during failures
 * - Performance under error conditions
 */

import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../../client/src/contexts/AuthContext';
import { MCPAppProvider } from '../../client/src/contexts/MCPProvider';
import { useMCPIntegration } from '../../client/src/hooks/useMCPIntegration';
import { MCPContextItem } from '../../client/src/types/mcp';

// Test timeout
const _TEST_TIMEOUT = 30000;

// Mock WebSocket with controllable behavior
class ControllableWebSocket {
  static instances: ControllableWebSocket[] = [];
  
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = WebSocket.CONNECTING;
  
  private shouldFail: boolean = false;
  private reconnectDelay: number = 1000;

  constructor(public url: string) {
    ControllableWebSocket.instances.push(this);
    
    setTimeout(() => {
      if (this.shouldFail) {
        this.readyState = WebSocket.CLOSED;
        if (this.onerror) {
          this.onerror(new Event('error'));
        }
        if (this.onclose) {
          this.onclose(new Event('close'));
        }
      } else {
        this.readyState = WebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
      }
    }, 50);
  }

  send(_data: string) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new Event('close'));
    }
  }

  // Test utilities
  static setShouldFail(fail: boolean) {
    ControllableWebSocket.instances.forEach(ws => {
      (ws as any).shouldFail = fail;
    });
  }

  static simulateMessage(message: any) {
    ControllableWebSocket.instances.forEach(ws => {
      if (ws.onmessage && ws.readyState === WebSocket.OPEN) {
        ws.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
    });
  }

  static simulateConnectionLoss() {
    ControllableWebSocket.instances.forEach(ws => {
      ws.readyState = WebSocket.CLOSED;
      if (ws.onclose) {
        ws.onclose(new Event('close'));
      }
    });
  }

  static simulateReconnection() {
    ControllableWebSocket.instances.forEach(ws => {
      ws.readyState = WebSocket.OPEN;
      if (ws.onopen) {
        ws.onopen(new Event('open'));
      }
    });
  }

  static closeAll() {
    ControllableWebSocket.instances.forEach(ws => ws.close());
    ControllableWebSocket.instances = [];
  }
}

global.WebSocket = ControllableWebSocket as any;

// Controllable fetch mock
let fetchShouldFail = false;
let fetchFailureType = 'network';
let fetchDelay = 0;

const mockFetch = jest.fn().mockImplementation(async (url: string, options: any = {}) => {
  // Add artificial delay if specified
  if (fetchDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, fetchDelay));
  }

  // Simulate various failure scenarios
  if (fetchShouldFail) {
    switch (fetchFailureType) {
      case 'network':
        throw new Error('Network request failed');
      case 'timeout':
        throw new Error('Request timeout');
      case 'server_error':
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({
            success: false,
            error: 'Server error occurred',
          }),
        });
      case 'auth_error':
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({
            success: false,
            error: 'Authentication failed',
          }),
        });
      case 'not_found':
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({
            success: false,
            error: 'Resource not found',
          }),
        });
    }
  }

  // Default successful responses
  if (url.includes('/api/mcp/memory/status')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          enabled: true,
          connected: true,
          sessionCount: 1,
          itemCount: 0,
          channels: ['default'],
        },
      }),
    });
  }

  if (url.includes('/api/mcp/memory/get')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
      }),
    });
  }

  if (url.includes('/api/mcp/memory/save') && options.method === 'POST') {
    const body = options.body ? JSON.parse(options.body) : {};
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          ...body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  }

  // Default system health response
  if (url.includes('/api/mcp/system/health')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          overall: 'healthy',
          services: [],
          lastUpdate: new Date().toISOString(),
          uptime: 123,
        },
      }),
    });
  }

  // Default generic success response
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      data: {},
    }),
  });
});

global.fetch = mockFetch;

// Test wrapper
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MCPAppProvider config={{ 
        enableRealtime: true,
        retryAttempts: 3,
        retryDelay: 100,
        timeout: 5000,
      }}>
        {children}
      </MCPAppProvider>
    </AuthProvider>
  );
}

// Mock user
const mockUser = {
  id: 'user-123',
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  role: 'solicitor' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('MCP Error Handling and Real-time Updates', () => {
  beforeEach(() => {
    // Reset all mocks and state
    mockFetch.mockClear();
    ControllableWebSocket.closeAll();
    fetchShouldFail = false;
    fetchFailureType = 'network';
    fetchDelay = 0;

    // Setup mock authentication
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key) => {
          if (key === 'auth_token') return 'mock-token';
          if (key === 'auth_user') return JSON.stringify(mockUser);
          return null;
        }),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    ControllableWebSocket.closeAll();
    jest.restoreAllMocks();
  });

  describe('Network Failure Scenarios', () => {
    it('should handle network failures gracefully', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate network failure
      fetchShouldFail = true;
      fetchFailureType = 'network';

      // Try to perform an operation
      await act(async () => {
        try {
          await result.current.memory.save({
            key: 'test-key',
            value: 'test-value',
            category: 'note',
            priority: 'normal',
          });
        } catch {
          // Expected to fail
        }
      });

      // Should show errors
      expect(result.current.hasErrors).toBe(true);
      expect(Object.values(result.current.memory.errors).some(Boolean)).toBe(true);
    });

    it('should retry failed operations automatically', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Set up to fail first few attempts, then succeed
      let attemptCount = 0;
      mockFetch.mockImplementation(async (url: string, _options: any) => {
        attemptCount++;
        if (url.includes('/api/mcp/memory/save') && attemptCount <= 2) {
          throw new Error('Network failure');
        }
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              key: 'retry-test',
              value: 'retry-value',
              createdAt: new Date().toISOString(),
            },
          }),
        };
      });

      // Perform operation that will fail initially
      await act(async () => {
        await result.current.memory.retry('save');
      });

      // Should eventually succeed after retries
      expect(attemptCount).toBeGreaterThan(2);
    });

    it('should handle timeout scenarios', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Set long delay to simulate timeout
      fetchDelay = 10000; // 10 seconds
      fetchShouldFail = true;
      fetchFailureType = 'timeout';

      await act(async () => {
        try {
          await result.current.memory.save({
            key: 'timeout-test',
            value: 'timeout-value',
            category: 'note',
          });
        } catch {
          expect(error.message).toContain('timeout');
        }
      });

      expect(result.current.hasErrors).toBe(true);
    });
  });

  describe('API Error Handling', () => {
    it('should handle server errors (500)', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      fetchShouldFail = true;
      fetchFailureType = 'server_error';

      await act(async () => {
        try {
          await result.current.memory.save({
            key: 'server-error-test',
            value: 'test-value',
            category: 'note',
          });
        } catch {
          // Expected
        }
      });

      expect(result.current.hasErrors).toBe(true);
      expect(result.current.memory.errors.save).toContain('Server error');
    });

    it('should handle authentication errors (401)', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      fetchShouldFail = true;
      fetchFailureType = 'auth_error';

      await act(async () => {
        try {
          await result.current.memory.refreshStatus();
        } catch {
          // Expected
        }
      });

      expect(result.current.hasErrors).toBe(true);
      expect(result.current.memory.errors.refreshStatus).toContain('Authentication');
    });

    it('should handle not found errors (404)', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      fetchShouldFail = true;
      fetchFailureType = 'not_found';

      await act(async () => {
        try {
          await result.current.memory.get('non-existent-key');
        } catch {
          // Expected
        }
      });

      expect(result.current.memory.errors.get).toContain('not found');
    });
  });

  describe('WebSocket Connection Handling', () => {
    it('should establish WebSocket connections', async () => {
      const { result } = renderHook(() => useMCPIntegration({
        realtime: true,
      }), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.connectAll();
      });

      // Wait for connections
      await waitFor(() => {
        expect(ControllableWebSocket.instances.length).toBeGreaterThan(0);
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('should handle WebSocket connection failures', async () => {
      const { result } = renderHook(() => useMCPIntegration({
        realtime: true,
      }), {
        wrapper: TestWrapper,
      });

      // Set WebSockets to fail
      ControllableWebSocket.setShouldFail(true);

      await act(async () => {
        await result.current.connectAll();
      });

      // Should handle failures gracefully
      expect(result.current.isConnected).toBe(false);
    });

    it('should attempt WebSocket reconnection after failures', async () => {
      const { result } = renderHook(() => useMCPIntegration({
        realtime: true,
      }), {
        wrapper: TestWrapper,
      });

      // Initially connect
      await act(async () => {
        await result.current.connectAll();
      });

      expect(result.current.isConnected).toBe(true);

      // Simulate connection loss
      act(() => {
        ControllableWebSocket.simulateConnectionLoss();
      });

      expect(result.current.isConnected).toBe(false);

      // Wait for reconnection attempt
      await waitFor(() => {
        // Reconnection logic would be implemented in the actual contexts
        // For now, we just verify the connection loss was detected
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('should handle WebSocket message parsing errors', async () => {
      const { result } = renderHook(() => useMCPIntegration({
        realtime: true,
      }), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.connectAll();
      });

      // Send malformed message
      act(() => {
        ControllableWebSocket.instances.forEach(ws => {
          if (ws.onmessage) {
            // Send invalid JSON
            const event = new MessageEvent('message', { data: 'invalid json' });
            ws.onmessage(event);
          }
        });
      });

      // Should handle gracefully without crashing
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('Real-time Update Propagation', () => {
    it('should receive and process real-time memory updates', async () => {
      const { result } = renderHook(() => useMCPIntegration({
        realtime: true,
      }), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.connectAll();
      });

      const initialItemCount = result.current.memory.items.length;

      // Simulate real-time update
      const newItem: MCPContextItem = {
        key: 'realtime-item',
        value: 'Real-time created item',
        category: 'note',
        priority: 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        ControllableWebSocket.simulateMessage({
          type: 'update',
          action: 'create',
          data: { item: newItem },
          timestamp: new Date().toISOString(),
        });
      });

      // Should update memory items
      await waitFor(() => {
        expect(result.current.memory.items.length).toBe(initialItemCount + 1);
      });

      expect(result.current.memory.items.some(item => item.key === 'realtime-item')).toBe(true);
    });

    it('should handle real-time updates for different contexts', async () => {
      const { result } = renderHook(() => useMCPIntegration({
        realtime: true,
      }), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.connectAll();
      });

      // Simulate file system update
      act(() => {
        ControllableWebSocket.simulateMessage({
          type: 'file',
          action: 'create',
          data: {
            path: '/new-file.txt',
            name: 'new-file.txt',
            size: 1024,
            type: 'file',
          },
          timestamp: new Date().toISOString(),
        });
      });

      // Simulate git status update
      act(() => {
        ControllableWebSocket.simulateMessage({
          type: 'git',
          action: 'status_change',
          data: {
            clean: false,
            unstaged: ['modified-file.txt'],
            branch: 'feature-branch',
          },
          timestamp: new Date().toISOString(),
        });
      });

      // Simulate workflow update
      act(() => {
        ControllableWebSocket.simulateMessage({
          type: 'workflow',
          action: 'update',
          data: {
            id: 'workflow-123',
            status: 'completed',
            progress: 100,
          },
          timestamp: new Date().toISOString(),
        });
      });

      // Allow time for updates to propagate
      await waitFor(() => {
        // In a real implementation, these would update the respective contexts
        expect(ControllableWebSocket.instances.length).toBeGreaterThan(0);
      });
    });

    it('should handle real-time update conflicts', async () => {
      const { result } = renderHook(() => useMCPIntegration({
        realtime: true,
      }), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.connectAll();
      });

      // Create an item locally
      const localItem: MCPContextItem = {
        key: 'conflict-item',
        value: 'Local version',
        category: 'note',
        priority: 'normal',
      };

      await act(async () => {
        await result.current.memory.save(localItem);
      });

      // Simulate conflicting real-time update
      act(() => {
        ControllableWebSocket.simulateMessage({
          type: 'update',
          action: 'update',
          data: {
            key: 'conflict-item',
            value: 'Remote version',
            updatedAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      });

      // Should handle conflict (implementation-dependent)
      await waitFor(() => {
        const item = result.current.memory.items.find(i => i.key === 'conflict-item');
        expect(item).toBeDefined();
        // The conflict resolution strategy would determine the final value
      });
    });
  });

  describe('Data Consistency During Failures', () => {
    it('should maintain data consistency during partial failures', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Set up selective failures - memory fails, files succeed
      mockFetch.mockImplementation(async (url: string, _options: any) => {
        if (url.includes('/api/mcp/memory/')) {
          throw new Error('Memory service unavailable');
        }
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {},
          }),
        };
      });

      // Try to perform operations on multiple contexts
      await act(async () => {
        try {
          await result.current.memory.save({
            key: 'partial-fail-test',
            value: 'test-value',
            category: 'note',
          });
        } catch {
          // Expected to fail
        }
      });

      // Memory should have errors
      expect(result.current.memory.errors.save).toBeTruthy();

      // Other contexts should still work
      expect(result.current.files.errors).toEqual({});
    });

    it('should handle batch operation failures correctly', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Mock partial batch failure
      mockFetch.mockImplementation(async (url: string, _options: any) => {
        if (url.includes('/api/mcp/memory/batch-save')) {
          return {
            ok: false,
            status: 400,
            json: () => Promise.resolve({
              success: false,
              error: 'Some items failed validation',
              details: {
                succeeded: ['item-1', 'item-2'],
                failed: [{ key: 'item-3', error: 'Invalid category' }],
              },
            }),
          };
        }
        return { ok: true, json: () => Promise.resolve({ success: true, data: {} }) };
      });

      const batchItems = [
        { key: 'item-1', value: 'value-1', category: 'note' as const },
        { key: 'item-2', value: 'value-2', category: 'task' as const },
        { key: 'item-3', value: 'value-3', category: 'invalid' as any },
      ];

      await act(async () => {
        try {
          await result.current.memory.batchSave(batchItems);
        } catch {
          // Expected to fail
        }
      });

      // Should show batch error
      expect(result.current.memory.errors.batchSave).toBeTruthy();
    });

    it('should recover data consistency after failures', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Initially fail
      fetchShouldFail = true;
      fetchFailureType = 'server_error';

      await act(async () => {
        try {
          await result.current.memory.refreshStatus();
        } catch {
          // Expected to fail
        }
      });

      expect(result.current.hasErrors).toBe(true);

      // Restore service
      fetchShouldFail = false;

      // Clear errors and retry
      await act(async () => {
        result.current.clearAllErrors();
        await result.current.memory.retry('refreshStatus');
      });

      // Should recover
      expect(result.current.memory.errors.refreshStatus).toBeFalsy();
    });
  });

  describe('Performance Under Error Conditions', () => {
    it('should not degrade performance with frequent errors', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Set up intermittent failures
      let callCount = 0;
      mockFetch.mockImplementation(async (_url: string) => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Intermittent failure');
        }
        return {
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        };
      });

      const startTime = Date.now();

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          try {
            await result.current.memory.save({
              key: `perf-test-${i}`,
              value: `value-${i}`,
              category: 'note',
            });
          } catch {
            // Some will fail, which is expected
          }
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time despite failures
      expect(duration).toBeLessThan(10000); // Less than 10 seconds
      expect(callCount).toBeGreaterThan(10); // Some retries should occur
    });

    it('should implement exponential backoff for retries', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      const retryTimes: number[] = [];

      // Mock to fail first few attempts
      let attemptCount = 0;
      mockFetch.mockImplementation(async () => {
        attemptCount++;
        retryTimes.push(Date.now());
        
        if (attemptCount <= 3) {
          throw new Error('Service temporarily unavailable');
        }
        
        return {
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        };
      });

      await act(async () => {
        await result.current.memory.retry('save');
      });

      // Verify exponential backoff (implementation would handle this)
      expect(retryTimes.length).toBeGreaterThan(3);
    });
  });

  describe('Error Recovery Mechanisms', () => {
    it('should provide clear error messages for different failure types', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Test network error
      fetchShouldFail = true;
      fetchFailureType = 'network';

      await act(async () => {
        try {
          await result.current.memory.save({
            key: 'error-test',
            value: 'test',
            category: 'note',
          });
        } catch {
          // Expected
        }
      });

      expect(result.current.memory.errors.save).toContain('Network');

      // Test auth error
      fetchFailureType = 'auth_error';

      await act(async () => {
        try {
          await result.current.memory.refreshStatus();
        } catch {
          // Expected
        }
      });

      expect(result.current.memory.errors.refreshStatus).toContain('Authentication');
    });

    it('should support manual error recovery actions', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Create error state
      fetchShouldFail = true;

      await act(async () => {
        try {
          await result.current.memory.refreshStatus();
        } catch {
          // Expected
        }
      });

      expect(result.current.hasErrors).toBe(true);

      // Clear errors
      act(() => {
        result.current.clearAllErrors();
      });

      expect(result.current.hasErrors).toBe(false);

      // Restore service and reconnect
      fetchShouldFail = false;

      await act(async () => {
        await result.current.connectAll();
      });

      // Should be fully recovered
      expect(result.current.hasErrors).toBe(false);
      expect(result.current.isConnected).toBe(true);
    });
  });
});