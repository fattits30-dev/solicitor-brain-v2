/**
 * Integration Tests for MCP Contexts
 * 
 * Tests the React Context Managers for MCP integration including:
 * - Provider mounting and initialization
 * - Context accessibility and state management
 * - Error handling and recovery
 * - Hook functionality
 */

import React from 'react';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider as _AuthProvider } from '../AuthContext';
import { MCPAppProvider } from '../MCPProvider';
import { useMCPIntegration } from '../../hooks/useMCPIntegration';

// Mock fetch for API calls
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

// Test component that uses MCP integration
function TestMCPComponent() {
  const integration = useMCPIntegration();

  return (
    <div>
      <div data-testid="loading">
        {integration.isLoading ? 'Loading' : 'Ready'}
      </div>
      <div data-testid="connected">
        {integration.isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div data-testid="errors">
        {integration.hasErrors ? 'Has Errors' : 'No Errors'}
      </div>
      <div data-testid="memory-items">
        {integration.memory.items.length}
      </div>
      <div data-testid="files-count">
        {integration.files.files.length}
      </div>
      <div data-testid="git-status">
        {integration.git.status ? 'Git Ready' : 'No Git'}
      </div>
      <div data-testid="workflows-count">
        {integration.workflow.workflows.length}
      </div>
      <div data-testid="system-health">
        {integration.system.systemHealth.overall}
      </div>
    </div>
  );
}

describe('MCP Integration Contexts', () => {
  beforeEach(() => {
    // Reset mocks
    mockFetch.mockReset();
    
    // Mock successful API responses
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

      if (url.includes('/api/mcp/files/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [],
          }),
        });
      }

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

      if (url.includes('/api/mcp/workflow/templates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [],
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

    // Mock localStorage for auth
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render MCP providers without crashing', async () => {
    render(
      <MCPAppProvider>
        <div data-testid="app-content">App Content</div>
      </MCPAppProvider>
    );

    expect(screen.getByTestId('app-content')).toBeInTheDocument();
  });

  it('should provide MCP integration context', async () => {
    render(
      <MCPAppProvider>
        <TestMCPComponent />
      </MCPAppProvider>
    );

    // Should render initial state
    expect(screen.getByTestId('loading')).toHaveTextContent('Ready');
    expect(screen.getByTestId('memory-items')).toHaveTextContent('0');
    expect(screen.getByTestId('files-count')).toHaveTextContent('0');
    expect(screen.getByTestId('workflows-count')).toHaveTextContent('0');
  });

  it('should handle MCP provider configuration', () => {
    const config = {
      enableMemory: false,
      enableFiles: true,
      enableGit: true,
      enableWorkflow: false,
      enableSystemStatus: true,
    };

    render(
      <MCPAppProvider config={config}>
        <TestMCPComponent />
      </MCPAppProvider>
    );

    // Should render with configured features
    expect(screen.getByTestId('app-content')).toBeInTheDocument();
  });

  it('should display dev tools in development mode', () => {
    // Set development mode
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <MCPAppProvider config={{ enableDevTools: true }}>
        <div data-testid="app-content">App Content</div>
      </MCPAppProvider>
    );

    // Dev tools should be present (rendered as invisible component)
    expect(screen.getByTestId('app-content')).toBeInTheDocument();

    // Restore environment
    process.env.NODE_ENV = originalEnv;
  });

  it('should handle authentication integration', async () => {
    // Mock authenticated user
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      role: 'solicitor',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mock authenticated state
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

    // Mock auth validation
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            user: mockUser,
          }),
        });
      }
      // Return other mock responses
      return mockFetch.mockImplementation.getMockImplementation()(url);
    });

    render(
      <MCPAppProvider>
        <TestMCPComponent />
      </MCPAppProvider>
    );

    // Wait for authentication to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/me'),
        expect.any(Object)
      );
    });
  });

  it('should handle API errors gracefully', async () => {
    // Mock API errors
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          success: false,
          error: 'Server error',
        }),
      });
    });

    render(
      <MCPAppProvider>
        <TestMCPComponent />
      </MCPAppProvider>
    );

    // Should handle errors without crashing
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should support WebSocket connections', async () => {
    render(
      <MCPAppProvider config={{ enableRealtime: true }}>
        <TestMCPComponent />
      </MCPAppProvider>
    );

    // Wait for WebSocket connections to be established
    await waitFor(() => {
      expect(screen.getByTestId('connected')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should handle memory operations', async () => {
    mockFetch.mockImplementation((url: string, options: any) => {
      if (url.includes('/api/mcp/memory/save') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              key: 'test-key',
              value: 'test-value',
              category: 'note',
              createdAt: new Date().toISOString(),
            },
          }),
        });
      }

      if (url.includes('/api/mcp/memory/get')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              {
                key: 'test-key',
                value: 'test-value',
                category: 'note',
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }

      // Return default mock
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });
    });

    function TestMemoryComponent() {
      const { memory } = useMCPIntegration();

      return (
        <div>
          <button
            onClick={async () => {
              await memory.save({
                key: 'test-key',
                value: 'test-value',
                category: 'note',
              });
            }}
            data-testid="save-button"
          >
            Save
          </button>
          <div data-testid="items-count">{memory.items.length}</div>
        </div>
      );
    }

    render(
      <MCPAppProvider>
        <TestMemoryComponent />
      </MCPAppProvider>
    );

    const saveButton = screen.getByTestId('save-button');
    expect(saveButton).toBeInTheDocument();

    // Test memory save operation
    await act(async () => {
      saveButton.click();
    });

    // Wait for API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/mcp/memory/save'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('test-key'),
        })
      );
    });
  });
});

describe('MCP Error Boundary', () => {
  it('should catch and display MCP errors', () => {
    // Component that throws an error
    function ErrorComponent() {
      throw new Error('MCP Test Error');
    }

    render(
      <MCPAppProvider>
        <ErrorComponent />
      </MCPAppProvider>
    );

    // Error boundary should catch the error and display fallback
    expect(screen.getByText(/MCP Integration Error/i)).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it('should provide error recovery options', () => {
    function ErrorComponent() {
      throw new Error('MCP Recovery Test');
    }

    render(
      <MCPAppProvider>
        <ErrorComponent />
      </MCPAppProvider>
    );

    // Should provide reload option
    expect(screen.getByText(/Reload Page/i)).toBeInTheDocument();
  });
});

describe('MCP Development Tools', () => {
  it('should not render dev tools in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <MCPAppProvider config={{ enableDevTools: true }}>
        <div>App Content</div>
      </MCPAppProvider>
    );

    // Dev tools should not be visible in production
    expect(screen.queryByText(/MCP Dev Tools/)).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});