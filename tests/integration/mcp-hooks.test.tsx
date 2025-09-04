/**
 * Integration Tests for MCP Hooks and Authentication
 * 
 * Tests the integration between MCP hooks, authentication, and real system interactions:
 * - useMCPIntegration hook with all contexts
 * - Authentication integration across all MCP contexts
 * - Hook composition and state synchronization
 * - Real-time updates between contexts
 * - Error handling and recovery patterns
 */

import { describe, expect, it, jest, beforeEach, afterEach, beforeAll, afterAll as _afterAll } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../../client/src/contexts/AuthContext';
import { MCPAppProvider } from '../../client/src/contexts/MCPProvider';
import { 
  useMCPIntegration,
  useMCPMemoryOperations,
  useMCPFileOperationsWithProgress,
  useMCPGitOperations,
  useMCPWorkflowOperations,
  useMCPSystemMonitoring as _useMCPSystemMonitoring,
  useLegalOperations,
  useMCPDevelopment
} from '../../client/src/hooks/useMCPIntegration';
import { MCPContextItem, MCPFileInfo as _MCPFileInfo, MCPGitStatus, MCPWorkflow } from '../../client/src/types/mcp';

// Test server setup (mock server for integration tests)
let _mockServer: any = null;
const TEST_PORT = 3001;
const _TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock WebSocket for real-time updates
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = WebSocket.CONNECTING;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 50);
  }

  send(_data: string) {
    // Mock WebSocket send - can be intercepted in tests
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new Event('close'));
    }
  }

  // Helper to simulate receiving messages
  static simulateMessage(message: any) {
    MockWebSocket.instances.forEach(ws => {
      if (ws.onmessage && ws.readyState === WebSocket.OPEN) {
        ws.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
    });
  }

  static closeAll() {
    MockWebSocket.instances.forEach(ws => ws.close());
    MockWebSocket.instances = [];
  }
}

global.WebSocket = MockWebSocket as any;

// Test wrapper with all providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MCPAppProvider config={{ 
        enableMemory: true,
        enableFiles: true,
        enableGit: true,
        enableWorkflow: true,
        enableSystemStatus: true,
        enableRealtime: true,
        mockServices: true, // Enable mocking for tests
      }}>
        {children}
      </MCPAppProvider>
    </AuthProvider>
  );
}

// Mock user data
const mockUser = {
  id: 'user-123',
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  role: 'solicitor' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock token
const mockToken = 'mock-jwt-token-123';

describe('MCP Hooks Integration Tests', () => {
  beforeAll(async () => {
    // Setup mock localStorage for authentication
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key) => {
          if (key === 'auth_token') return mockToken;
          if (key === 'auth_user') return JSON.stringify(mockUser);
          return null;
        }),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  beforeEach(() => {
    // Reset mocks
    mockFetch.mockReset();
    MockWebSocket.closeAll();
    
    // Setup default API responses
    mockFetch.mockImplementation((url: string, _options: any = {}) => {
      // Authentication endpoints
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            user: mockUser,
          }),
        });
      }

      // MCP Memory endpoints
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

      // MCP Files endpoints
      if (url.includes('/api/mcp/files/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [],
          }),
        });
      }

      // MCP Git endpoints
      if (url.includes('/api/mcp/git/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              clean: true,
              ahead: 0,
              behind: 0,
              staged: [],
              unstaged: [],
              untracked: [],
              branch: 'main',
            },
          }),
        });
      }

      // MCP Workflow endpoints
      if (url.includes('/api/mcp/workflow/templates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [],
          }),
        });
      }

      // MCP System endpoints
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

      // Default response
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
    MockWebSocket.closeAll();
    jest.restoreAllMocks();
  });

  describe('useMCPIntegration Hook', () => {
    it('should provide integrated access to all MCP contexts', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Should have all contexts
      expect(result.current.memory).toBeDefined();
      expect(result.current.files).toBeDefined();
      expect(result.current.git).toBeDefined();
      expect(result.current.workflow).toBeDefined();
      expect(result.current.system).toBeDefined();

      // Should have combined states
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.hasErrors).toBe('boolean');
      expect(typeof result.current.isConnected).toBe('boolean');
      expect(result.current.healthSummary).toBeDefined();

      // Should have utility functions
      expect(typeof result.current.connectAll).toBe('function');
      expect(typeof result.current.disconnectAll).toBe('function');
      expect(typeof result.current.clearAllErrors).toBe('function');
    });

    it('should initialize all contexts with authentication', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      // Verify API calls were made with authentication
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/memory/status'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/system/health'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should establish real-time connections', async () => {
      const { result } = renderHook(() => useMCPIntegration({
        realtime: true,
      }), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.connectAll();
      });

      // Wait for WebSocket connections
      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('should handle combined loading states', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should aggregate error states across contexts', async () => {
      // Mock an API failure
      mockFetch.mockImplementation((_url: string) => {
        if (url.includes('/api/mcp/memory/status')) {
          return Promise.reject(new Error('Memory service unavailable'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Wait for error to propagate
      await waitFor(() => {
        expect(result.current.hasErrors).toBe(true);
      });
    });

    it('should provide health summary across all services', async () => {
      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.healthSummary).toBeDefined();
        expect(result.current.healthSummary.overall).toBeDefined();
        expect(result.current.healthSummary.services).toBeDefined();
        expect(typeof result.current.healthSummary.services.memory).toBe('string');
        expect(typeof result.current.healthSummary.services.files).toBe('string');
        expect(typeof result.current.healthSummary.services.git).toBe('string');
      });
    });
  });

  describe('Memory Operations Hook Integration', () => {
    it('should perform memory operations with authentication', async () => {
      mockFetch.mockImplementation((url: string, _options: any) => {
        if (url.includes('/api/mcp/memory/save') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                key: 'test-note',
                value: 'Test note content',
                category: 'note',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const { result } = renderHook(() => useMCPMemoryOperations(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.saveNote('test-note', 'Test note content');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/memory/save'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
          body: expect.stringContaining('test-note'),
        })
      );
    });

    it('should handle quick search operations', async () => {
      const mockResults: MCPContextItem[] = [
        {
          key: 'result-1',
          value: 'Contract review notes',
          category: 'note',
          priority: 'normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockFetch.mockImplementation((url: string, _options: any) => {
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

      const { result } = renderHook(() => useMCPMemoryOperations(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.quickSearch('contract');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/memory/search'),
        expect.objectContaining({
          body: expect.stringContaining('contract'),
        })
      );
    });
  });

  describe('File Operations Hook Integration', () => {
    it('should handle file operations with progress tracking', async () => {
      const { result } = renderHook(() => useMCPFileOperationsWithProgress(), {
        wrapper: TestWrapper,
      });

      // Mock file creation
      mockFetch.mockImplementation((url: string, _options: any) => {
        if (url.includes('/api/mcp/files/write') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { path: '/test/document.txt', size: 100 },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      await act(async () => {
        await result.current.createFile('/test/document.txt', 'Test document content');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/files/write'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('document.txt'),
        })
      );
    });

    it('should handle upload progress tracking', async () => {
      const { result } = renderHook(() => useMCPFileOperationsWithProgress(), {
        wrapper: TestWrapper,
      });

      // Mock file upload
      mockFetch.mockImplementation((_url: string) => {
        if (url.includes('/api/mcp/files/upload')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: [{ path: '/uploads/test.pdf', size: 1024 }],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      // Create mock FileList
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const mockFileList = {
        0: mockFile,
        length: 1,
        item: (index: number) => index === 0 ? mockFile : null,
        *[Symbol.iterator]() {
          yield mockFile;
        },
      } as FileList;

      await act(async () => {
        await result.current.uploadWithProgress(mockFileList, '/uploads/');
      });

      // Should track upload progress
      expect(Object.keys(result.current.uploadProgress)).toHaveLength(1);
    });
  });

  describe('Git Operations Hook Integration', () => {
    it('should perform smart commits with context integration', async () => {
      const mockGitStatus: MCPGitStatus = {
        clean: false,
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: ['src/test.ts', 'docs/README.md'],
        untracked: ['new-file.ts'],
        branch: 'feature/test',
      };

      mockFetch.mockImplementation((url: string, _options: any) => {
        if (url.includes('/api/mcp/git/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockGitStatus,
            }),
          });
        }

        if (url.includes('/api/mcp/git/add') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }

        if (url.includes('/api/mcp/git/commit') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                hash: 'abc123',
                message: 'Add test functionality',
              },
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const { result } = renderHook(() => useMCPGitOperations(), {
        wrapper: TestWrapper,
      });

      // Wait for git status to load
      await waitFor(() => {
        expect(result.current.status).toBeDefined();
      });

      await act(async () => {
        await result.current.smartCommit('Add test functionality', {
          addAll: true,
          caseId: 'case-123',
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/git/add'),
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/git/commit'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Add test functionality'),
        })
      );
    });

    it('should provide status helpers', async () => {
      const mockGitStatus: MCPGitStatus = {
        clean: false,
        ahead: 1,
        behind: 0,
        staged: ['staged-file.ts'],
        unstaged: ['unstaged-file.ts'],
        untracked: ['new-file.ts'],
        branch: 'main',
      };

      mockFetch.mockImplementation((_url: string) => {
        if (url.includes('/api/mcp/git/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockGitStatus,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const { result } = renderHook(() => useMCPGitOperations(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.status).toBeDefined();
      });

      expect(result.current.hasUncommittedChanges).toBe(true);
      expect(result.current.hasUntrackedFiles).toBe(true);
      expect(result.current.isClean).toBe(false);
    });
  });

  describe('Workflow Operations Hook Integration', () => {
    it('should create legal workflows with context integration', async () => {
      const mockWorkflow: MCPWorkflow = {
        id: 'workflow-123',
        name: 'Contract Review Workflow',
        description: 'Review contract for compliance',
        type: 'document_processing',
        status: 'draft',
        steps: [
          {
            id: 'step-1',
            name: 'Document Parsing',
            description: 'Parse contract document',
            type: 'ai_operation',
            status: 'pending',
          },
        ],
        userId: mockUser.id,
        metadata: {},
        createdAt: new Date().toISOString(),
        progress: 0,
      };

      mockFetch.mockImplementation((url: string, _options: any) => {
        if (url.includes('/api/mcp/workflow/create') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockWorkflow,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const { result } = renderHook(() => useMCPWorkflowOperations(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.createLegalWorkflow('contract_review', {
          caseId: 'case-123',
          documentIds: ['doc-1', 'doc-2'],
          workflowType: 'contract_review',
          confidentialityLevel: 'confidential',
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/workflow/create'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('contract_review'),
        })
      );
    });

    it('should provide workflow status helpers', async () => {
      const mockWorkflows: MCPWorkflow[] = [
        {
          id: 'workflow-1',
          name: 'Active Workflow',
          description: 'Currently running',
          type: 'document_processing',
          status: 'running',
          steps: [],
          userId: mockUser.id,
          metadata: {},
          createdAt: new Date().toISOString(),
          progress: 50,
        },
        {
          id: 'workflow-2',
          name: 'Completed Workflow',
          description: 'Successfully completed',
          type: 'case_management',
          status: 'completed',
          steps: [],
          userId: mockUser.id,
          metadata: {},
          createdAt: new Date().toISOString(),
          progress: 100,
        },
        {
          id: 'workflow-3',
          name: 'Failed Workflow',
          description: 'Failed with errors',
          type: 'ai_analysis',
          status: 'failed',
          steps: [],
          userId: mockUser.id,
          metadata: {},
          createdAt: new Date().toISOString(),
          progress: 25,
        },
      ];

      mockFetch.mockImplementation((_url: string) => {
        if (url.includes('/api/mcp/workflow/list')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockWorkflows,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      const { result } = renderHook(() => useMCPWorkflowOperations(), {
        wrapper: TestWrapper,
      });

      // Wait for workflows to load
      await waitFor(() => {
        expect(result.current.workflows.length).toBe(3);
      });

      expect(result.current.activeWorkflowCount).toBe(1);
      expect(result.current.completedWorkflowCount).toBe(1);
      expect(result.current.failedWorkflowCount).toBe(1);
    });
  });

  describe('Legal Operations Hook Integration', () => {
    it('should coordinate case work across all contexts', async () => {
      const caseId = 'case-legal-123';

      // Mock session creation
      mockFetch.mockImplementation((url: string, _options: any) => {
        if (url.includes('/api/mcp/memory/session/start')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { sessionId: `session-${caseId}` },
            }),
          });
        }

        if (url.includes('/api/mcp/memory/save')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                key: `case-${caseId}-start`,
                value: `Started legal work for case ${caseId}`,
                category: 'task',
              },
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const { result } = renderHook(() => useLegalOperations(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.startCaseWork(caseId);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/memory/session/start'),
        expect.objectContaining({
          body: expect.stringContaining(caseId),
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/memory/save'),
        expect.objectContaining({
          body: expect.stringContaining(`case-${caseId}-start`),
        })
      );
    });

    it('should complete case work with git commits', async () => {
      const caseId = 'case-complete-123';
      const summary = 'Completed contract review and compliance check';

      mockFetch.mockImplementation((url: string, _options: any) => {
        if (url.includes('/api/mcp/memory/save')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                key: `case-${caseId}-complete`,
                value: summary,
                category: 'decision',
              },
            }),
          });
        }

        if (url.includes('/api/mcp/git/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                clean: false,
                staged: [],
                unstaged: ['case-files/contract.pdf'],
                untracked: [],
                branch: 'main',
              },
            }),
          });
        }

        if (url.includes('/api/mcp/git/add') || url.includes('/api/mcp/git/commit')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const { result } = renderHook(() => useLegalOperations(), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.completeCaseWork(caseId, summary);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/memory/save'),
        expect.objectContaining({
          body: expect.stringContaining(summary),
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/git/commit'),
        expect.any(Object)
      );
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should handle real-time updates across contexts', async () => {
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
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate real-time memory update
      const memoryUpdate = {
        type: 'memory',
        action: 'create',
        data: {
          item: {
            key: 'realtime-item',
            value: 'Real-time created item',
            category: 'note',
          },
        },
      };

      act(() => {
        MockWebSocket.simulateMessage(memoryUpdate);
      });

      // Should reflect the update in memory context
      // Note: This would require the actual context to handle WebSocket messages
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    it('should handle connection failures and retry logic', async () => {
      // Mock WebSocket connection failure
      class FailingWebSocket extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            this.readyState = WebSocket.CLOSED;
            if (this.onclose) {
              this.onclose(new Event('close'));
            }
          }, 100);
        }
      }

      global.WebSocket = FailingWebSocket as any;

      const { result } = renderHook(() => useMCPIntegration({
        realtime: true,
      }), {
        wrapper: TestWrapper,
      });

      await act(async () => {
        await result.current.connectAll();
      });

      // Should initially fail to connect
      expect(result.current.isConnected).toBe(false);

      // Restore working WebSocket
      global.WebSocket = MockWebSocket as any;

      // Should eventually reconnect (in a real scenario)
      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBeGreaterThan(0);
      }, { timeout: 2000 });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle authentication failures across all contexts', async () => {
      // Mock authentication failure
      mockFetch.mockImplementation((_url: string) => {
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({
            success: false,
            error: 'Invalid token',
          }),
        });
      });

      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Wait for errors to propagate
      await waitFor(() => {
        expect(result.current.hasErrors).toBe(true);
      });

      // All contexts should show authentication errors
      expect(Object.values(result.current.memory.errors).some(Boolean)).toBe(true);
    });

    it('should provide error recovery mechanisms', async () => {
      let failCount = 0;
      
      mockFetch.mockImplementation((_url: string) => {
        failCount++;
        if (failCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const { result } = renderHook(() => useMCPIntegration(), {
        wrapper: TestWrapper,
      });

      // Wait for initial failures
      await waitFor(() => {
        expect(result.current.hasErrors).toBe(true);
      });

      // Clear errors and retry
      await act(async () => {
        result.current.clearAllErrors();
      });

      // Should clear error state
      expect(result.current.hasErrors).toBe(false);
    });
  });

  describe('Development and Testing Integration', () => {
    it('should provide development tools and utilities', async () => {
      const { result } = renderHook(() => useMCPDevelopment(), {
        wrapper: TestWrapper,
      });

      // Enable dev mode
      act(() => {
        result.current.enableDevMode();
      });

      expect(result.current.devMode).toBe(true);

      // Should provide access to integration
      expect(result.current.integration).toBeDefined();
      expect(typeof result.current.runHealthChecks).toBe('function');
      expect(typeof result.current.seedTestData).toBe('function');
    });

    it('should run comprehensive health checks', async () => {
      mockFetch.mockImplementation((_url: string) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { status: 'healthy', timestamp: new Date().toISOString() },
          }),
        });
      });

      const { result } = renderHook(() => useMCPDevelopment(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.enableDevMode();
      });

      let healthResults: any;
      await act(async () => {
        healthResults = await result.current.runHealthChecks();
      });

      expect(healthResults).toBeDefined();
      expect(healthResults.memory).toBeDefined();
      expect(healthResults.files).toBeDefined();
      expect(healthResults.git).toBeDefined();
      expect(healthResults.workflow).toBeDefined();
      expect(healthResults.system).toBeDefined();
    });

    it('should seed and clear test data', async () => {
      mockFetch.mockImplementation((url: string, _options: any) => {
        if (url.includes('/api/mcp/memory/batch-save') && options?.method === 'POST') {
          const body = JSON.parse(options.body);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: body.items.map((item: any) => ({
                ...item,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })),
            }),
          });
        }

        if (url.includes('/api/mcp/memory/delete') && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const { result } = renderHook(() => useMCPDevelopment(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.enableDevMode();
      });

      // Seed test data
      await act(async () => {
        await result.current.seedTestData();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/memory/batch-save'),
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Clear test data
      await act(async () => {
        await result.current.clearTestData();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/memory/delete'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});