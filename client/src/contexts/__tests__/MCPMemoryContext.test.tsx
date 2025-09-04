/**
 * Unit Tests for MCP Memory Context
 * 
 * Tests the MCPMemoryContext provider and hooks including:
 * - Context state management and reducers
 * - CRUD operations for memory items
 * - Search and filtering functionality
 * - Session management
 * - Real-time WebSocket connections
 * - Error handling and recovery
 */

import React from 'react';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MCPMemoryProvider, useMCPMemory } from '../MCPMemoryContext';
import { AuthProvider } from '../AuthContext';
import { MCPContextItem as _MCPContextItem, MCPSearchOptions as _MCPSearchOptions } from '../../types/mcp';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock WebSocket
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = WebSocket.CONNECTING;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(_data: string) {
    // Mock WebSocket send
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new Event('close'));
    }
  }
}

global.WebSocket = MockWebSocket as any;

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MCPMemoryProvider>
        {children}
      </MCPMemoryProvider>
    </AuthProvider>
  );
}

// Test component that uses MCP Memory
function TestMemoryComponent() {
  const memory = useMCPMemory();

  return (
    <div>
      <div data-testid="loading-state">
        {Object.keys(memory.loading).length > 0 ? 'Loading' : 'Ready'}
      </div>
      <div data-testid="items-count">{memory.items.length}</div>
      <div data-testid="search-results-count">{memory.searchResults.length}</div>
      <div data-testid="current-session">{memory.currentSession || 'No Session'}</div>
      <div data-testid="connected">{memory.connected ? 'Connected' : 'Disconnected'}</div>
      <div data-testid="errors">
        {Object.values(memory.errors).filter(Boolean).length}
      </div>
      
      <button 
        data-testid="save-item" 
        onClick={async () => {
          await memory.save({
            key: 'test-key',
            value: 'test-value',
            category: 'note',
            priority: 'normal',
          });
        }}
      >
        Save Item
      </button>
      
      <button 
        data-testid="search" 
        onClick={async () => {
          await memory.search({ query: 'test' });
        }}
      >
        Search
      </button>
      
      <button 
        data-testid="refresh-status" 
        onClick={async () => {
          await memory.refreshStatus();
        }}
      >
        Refresh Status
      </button>
    </div>
  );
}

describe('MCPMemoryContext', () => {
  beforeEach(() => {
    // Reset mocks
    mockFetch.mockReset();
    
    // Mock localStorage for auth
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    // Default API responses
    mockFetch.mockImplementation((url: string) => {
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

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {},
        }),
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Provider and Context', () => {
    it('should provide MCP Memory context without errors', () => {
      render(
        <TestWrapper>
          <TestMemoryComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('loading-state')).toHaveTextContent('Ready');
      expect(screen.getByTestId('items-count')).toHaveTextContent('0');
      expect(screen.getByTestId('connected')).toHaveTextContent('Disconnected');
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestMemoryComponent />);
      }).toThrow('useMCPMemory must be used within an MCPMemoryProvider');
      
      consoleSpy.mockRestore();
    });

    it('should initialize status and items on mount', async () => {
      render(
        <TestWrapper>
          <TestMemoryComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/status'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/get'),
          expect.any(Object)
        );
      });
    });
  });

  describe('CRUD Operations', () => {
    it('should save memory items successfully', async () => {
      const mockItem: MCPContextItem = {
        key: 'test-key',
        value: 'test-value',
        category: 'note',
        priority: 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/save') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockItem,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      render(
        <TestWrapper>
          <TestMemoryComponent />
        </TestWrapper>
      );

      const saveButton = screen.getByTestId('save-item');
      
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/save'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer mock-token',
            }),
            body: expect.stringContaining('test-key'),
          })
        );
      });

      // Should show the new item
      await waitFor(() => {
        expect(screen.getByTestId('items-count')).toHaveTextContent('1');
      });
    });

    it('should handle save errors gracefully', async () => {
      mockFetch.mockImplementation((url: string, _options: any) => {
        if (url.includes('/api/mcp/memory/save')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: () => Promise.resolve({
              success: false,
              error: 'Database connection failed',
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      render(
        <TestWrapper>
          <TestMemoryComponent />
        </TestWrapper>
      );

      const saveButton = screen.getByTestId('save-item');
      
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // Should show error count
      await waitFor(() => {
        expect(screen.getByTestId('errors')).not.toHaveTextContent('0');
      });
    });

    it('should get individual items by key', async () => {
      const mockItem: MCPContextItem = {
        key: 'test-key',
        value: 'test-value',
        category: 'note',
        priority: 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/get') && options?.method === 'POST') {
          const body = JSON.parse(options.body);
          if (body.key === 'test-key') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                success: true,
                data: [mockItem],
              }),
            });
          }
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      function TestGetComponent() {
        const memory = useMCPMemory();
        const [result, setResult] = React.useState<MCPContextItem | null>(null);

        return (
          <div>
            <button
              data-testid="get-item"
              onClick={async () => {
                const item = await memory.get('test-key');
                setResult(item);
              }}
            >
              Get Item
            </button>
            <div data-testid="result">
              {result ? result.value : 'No result'}
            </div>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestGetComponent />
        </TestWrapper>
      );

      const getButton = screen.getByTestId('get-item');
      
      await act(async () => {
        fireEvent.click(getButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('result')).toHaveTextContent('test-value');
      });
    });

    it('should update existing items', async () => {
      const mockUpdatedItem: MCPContextItem = {
        key: 'test-key',
        value: 'updated-value',
        category: 'note',
        priority: 'high',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/update') && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockUpdatedItem,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      function TestUpdateComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <button
              data-testid="update-item"
              onClick={async () => {
                await memory.update('test-key', { 
                  value: 'updated-value',
                  priority: 'high'
                });
              }}
            >
              Update Item
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestUpdateComponent />
        </TestWrapper>
      );

      const updateButton = screen.getByTestId('update-item');
      
      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/update'),
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('updated-value'),
          })
        );
      });
    });

    it('should delete items', async () => {
      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/delete') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      function TestDeleteComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <button
              data-testid="delete-item"
              onClick={async () => {
                await memory.remove('test-key');
              }}
            >
              Delete Item
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestDeleteComponent />
        </TestWrapper>
      );

      const deleteButton = screen.getByTestId('delete-item');
      
      await act(async () => {
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/delete'),
          expect.objectContaining({
            method: 'DELETE',
            body: expect.stringContaining('test-key'),
          })
        );
      });
    });

    it('should perform batch save operations', async () => {
      const mockItems: MCPContextItem[] = [
        {
          key: 'item-1',
          value: 'value-1',
          category: 'note',
          priority: 'normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          key: 'item-2',
          value: 'value-2',
          category: 'task',
          priority: 'high',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/batch-save') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockItems,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      function TestBatchSaveComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <button
              data-testid="batch-save"
              onClick={async () => {
                await memory.batchSave([
                  { key: 'item-1', value: 'value-1', category: 'note', priority: 'normal' },
                  { key: 'item-2', value: 'value-2', category: 'task', priority: 'high' },
                ]);
              }}
            >
              Batch Save
            </button>
            <div data-testid="items-count">{memory.items.length}</div>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestBatchSaveComponent />
        </TestWrapper>
      );

      const batchSaveButton = screen.getByTestId('batch-save');
      
      await act(async () => {
        fireEvent.click(batchSaveButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/batch-save'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('item-1'),
          })
        );
      });

      // Should show both items
      await waitFor(() => {
        expect(screen.getByTestId('items-count')).toHaveTextContent('2');
      });
    });
  });

  describe('Search Operations', () => {
    it('should perform search with results', async () => {
      const mockResults: MCPContextItem[] = [
        {
          key: 'search-result-1',
          value: 'This contains test keyword',
          category: 'note',
          priority: 'normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/search') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockResults,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      render(
        <TestWrapper>
          <TestMemoryComponent />
        </TestWrapper>
      );

      const searchButton = screen.getByTestId('search');
      
      await act(async () => {
        fireEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/search'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('test'),
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('search-results-count')).toHaveTextContent('1');
      });
    });

    it('should clear search results and filters', () => {
      function TestSearchClearComponent() {
        const memory = useMCPMemory();

        // Set some mock search state
        React.useEffect(() => {
          memory.search({ query: 'test' });
        }, []);

        return (
          <div>
            <div data-testid="search-query">{memory.searchQuery}</div>
            <button
              data-testid="clear-search"
              onClick={() => memory.clearSearch()}
            >
              Clear Search
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestSearchClearComponent />
        </TestWrapper>
      );

      const clearButton = screen.getByTestId('clear-search');
      
      act(() => {
        fireEvent.click(clearButton);
      });

      expect(screen.getByTestId('search-query')).toHaveTextContent('');
    });

    it('should set and manage filters', () => {
      function TestFiltersComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <div data-testid="active-filters">
              {JSON.stringify(memory.activeFilters)}
            </div>
            <button
              data-testid="set-filters"
              onClick={() => {
                memory.setFilters({
                  category: 'task',
                  priority: ['high'],
                  limit: 50,
                });
              }}
            >
              Set Filters
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestFiltersComponent />
        </TestWrapper>
      );

      const setFiltersButton = screen.getByTestId('set-filters');
      
      act(() => {
        fireEvent.click(setFiltersButton);
      });

      expect(screen.getByTestId('active-filters')).toHaveTextContent('task');
      expect(screen.getByTestId('active-filters')).toHaveTextContent('high');
    });
  });

  describe('Session Management', () => {
    it('should start a new session', async () => {
      const mockSessionId = 'session-12345';

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/session/start') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { sessionId: mockSessionId },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      function TestSessionComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <div data-testid="current-session">{memory.currentSession || 'None'}</div>
            <button
              data-testid="start-session"
              onClick={async () => {
                await memory.startSession('Test Session', 'A test session');
              }}
            >
              Start Session
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestSessionComponent />
        </TestWrapper>
      );

      const startButton = screen.getByTestId('start-session');
      
      await act(async () => {
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/session/start'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test Session'),
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-session')).toHaveTextContent(mockSessionId);
      });
    });

    it('should list sessions', async () => {
      const mockSessions = [
        { id: 'session-1', name: 'Session 1', createdAt: new Date().toISOString() },
        { id: 'session-2', name: 'Session 2', createdAt: new Date().toISOString() },
      ];

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/session/list') && options?.method === 'GET') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockSessions,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      function TestListSessionsComponent() {
        const memory = useMCPMemory();
        const [sessions, setSessions] = React.useState<any[]>([]);

        return (
          <div>
            <div data-testid="sessions-count">{sessions.length}</div>
            <button
              data-testid="list-sessions"
              onClick={async () => {
                const result = await memory.listSessions();
                setSessions(result);
              }}
            >
              List Sessions
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestListSessionsComponent />
        </TestWrapper>
      );

      const listButton = screen.getByTestId('list-sessions');
      
      await act(async () => {
        fireEvent.click(listButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('sessions-count')).toHaveTextContent('2');
      });
    });

    it('should switch sessions', async () => {
      const targetSessionId = 'session-target';

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/session/switch') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        if (url.includes('/api/mcp/memory/get') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: [], // Fresh items for new session
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      function TestSwitchSessionComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <div data-testid="current-session">{memory.currentSession || 'None'}</div>
            <button
              data-testid="switch-session"
              onClick={async () => {
                await memory.switchSession(targetSessionId);
              }}
            >
              Switch Session
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestSwitchSessionComponent />
        </TestWrapper>
      );

      const switchButton = screen.getByTestId('switch-session');
      
      await act(async () => {
        fireEvent.click(switchButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/session/switch'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining(targetSessionId),
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-session')).toHaveTextContent(targetSessionId);
      });
    });

    it('should branch sessions', async () => {
      const branchSessionId = 'session-branch';

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/session/branch') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { sessionId: branchSessionId },
            }),
          });
        }
        if (url.includes('/api/mcp/memory/get')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      function TestBranchSessionComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <div data-testid="current-session">{memory.currentSession || 'None'}</div>
            <button
              data-testid="branch-session"
              onClick={async () => {
                await memory.branchSession('feature-branch', 'deep');
              }}
            >
              Branch Session
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestBranchSessionComponent />
        </TestWrapper>
      );

      const branchButton = screen.getByTestId('branch-session');
      
      await act(async () => {
        fireEvent.click(branchButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/session/branch'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('feature-branch'),
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-session')).toHaveTextContent(branchSessionId);
      });
    });
  });

  describe('WebSocket Real-time Updates', () => {
    it('should establish WebSocket connection', async () => {
      render(
        <TestWrapper>
          <TestMemoryComponent />
        </TestWrapper>
      );

      // Wait for WebSocket connection
      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('Connected');
      }, { timeout: 1000 });
    });

    it('should handle real-time item updates', async () => {
      render(
        <TestWrapper>
          <TestMemoryComponent />
        </TestWrapper>
      );

      // Wait for connection
      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('Connected');
      }, { timeout: 1000 });

      // Simulate receiving a real-time update
      // Note: This would require more sophisticated WebSocket mocking
      // For now, we just verify the connection is established
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.reject(new Error('Network error'));
      });

      render(
        <TestWrapper>
          <TestMemoryComponent />
        </TestWrapper>
      );

      // Should not crash and should show errors
      await waitFor(() => {
        expect(screen.getByTestId('errors')).not.toHaveTextContent('0');
      });
    });

    it('should clear specific operation errors', async () => {
      function TestErrorClearComponent() {
        const memory = useMCPMemory();

        React.useEffect(() => {
          // Trigger an error first by calling a failing operation
          memory.save({ key: 'fail-key', value: 'fail-value', category: 'note' });
        }, []);

        return (
          <div>
            <div data-testid="errors">{Object.values(memory.errors).filter(Boolean).length}</div>
            <button
              data-testid="clear-errors"
              onClick={() => memory.clearErrors('save')}
            >
              Clear Save Errors
            </button>
          </div>
        );
      }

      mockFetch.mockImplementation(() => Promise.reject(new Error('API Error')));

      render(
        <TestWrapper>
          <TestErrorClearComponent />
        </TestWrapper>
      );

      // Wait for error to occur
      await waitFor(() => {
        expect(screen.getByTestId('errors')).not.toHaveTextContent('0');
      });

      const clearButton = screen.getByTestId('clear-errors');
      
      act(() => {
        fireEvent.click(clearButton);
      });

      // Error should be cleared
      expect(screen.getByTestId('errors')).toHaveTextContent('0');
    });

    it('should handle retry operations', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First call fails'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      function TestRetryComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <button
              data-testid="retry-get-all"
              onClick={async () => {
                await memory.retry('getAll');
              }}
            >
              Retry Get All
            </button>
            <div data-testid="errors">{Object.values(memory.errors).filter(Boolean).length}</div>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestRetryComponent />
        </TestWrapper>
      );

      // First call should fail (happens during mount)
      await waitFor(() => {
        expect(screen.getByTestId('errors')).not.toHaveTextContent('0');
      });

      const retryButton = screen.getByTestId('retry-get-all');
      
      await act(async () => {
        fireEvent.click(retryButton);
      });

      // Retry should succeed
      await waitFor(() => {
        expect(callCount).toBeGreaterThan(1);
      });
    });
  });

  describe('Status and Health', () => {
    it('should refresh status successfully', async () => {
      const mockStatus = {
        enabled: true,
        connected: true,
        sessionCount: 5,
        itemCount: 100,
        channels: ['default', 'cases', 'documents'],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/mcp/memory/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockStatus,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      function TestStatusComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <div data-testid="session-count">{memory.status.sessionCount || 0}</div>
            <div data-testid="item-count">{memory.status.itemCount || 0}</div>
            <button
              data-testid="refresh-status"
              onClick={async () => {
                await memory.refreshStatus();
              }}
            >
              Refresh Status
            </button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      const refreshButton = screen.getByTestId('refresh-status');
      
      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('session-count')).toHaveTextContent('5');
        expect(screen.getByTestId('item-count')).toHaveTextContent('100');
      });
    });
  });

  describe('Data Import/Export', () => {
    it('should export data in different formats', async () => {
      const mockExportData = {
        format: 'json',
        timestamp: new Date().toISOString(),
        data: [
          { key: 'test-1', value: 'value-1' },
          { key: 'test-2', value: 'value-2' },
        ],
      };

      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/export') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockExportData,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      function TestExportComponent() {
        const memory = useMCPMemory();
        const [exportData, setExportData] = React.useState<any>(null);

        return (
          <div>
            <button
              data-testid="export-json"
              onClick={async () => {
                const data = await memory.exportData('json');
                setExportData(data);
              }}
            >
              Export JSON
            </button>
            <div data-testid="export-result">
              {exportData ? JSON.stringify(exportData) : 'No data'}
            </div>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestExportComponent />
        </TestWrapper>
      );

      const exportButton = screen.getByTestId('export-json');
      
      await act(async () => {
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('export-result')).toHaveTextContent('json');
      });
    });

    it('should import data successfully', async () => {
      mockFetch.mockImplementation((url: string, options: any) => {
        if (url.includes('/api/mcp/memory/import') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        if (url.includes('/api/mcp/memory/get')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: [
                { key: 'imported-1', value: 'imported-value-1' },
                { key: 'imported-2', value: 'imported-value-2' },
              ],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      function TestImportComponent() {
        const memory = useMCPMemory();

        return (
          <div>
            <button
              data-testid="import-data"
              onClick={async () => {
                await memory.importData({
                  items: [
                    { key: 'imported-1', value: 'imported-value-1' },
                    { key: 'imported-2', value: 'imported-value-2' },
                  ],
                }, true);
              }}
            >
              Import Data
            </button>
            <div data-testid="items-count">{memory.items.length}</div>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestImportComponent />
        </TestWrapper>
      );

      const importButton = screen.getByTestId('import-data');
      
      await act(async () => {
        fireEvent.click(importButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/mcp/memory/import'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('imported-1'),
          })
        );
      });

      // Should refresh items after import
      await waitFor(() => {
        expect(screen.getByTestId('items-count')).toHaveTextContent('2');
      });
    });
  });
});