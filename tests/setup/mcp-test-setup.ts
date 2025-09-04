/**
 * MCP Test Setup
 * Global setup and configuration for MCP-related tests
 */

import '@testing-library/jest-dom';

// Mock WebSocket for all tests
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = WebSocket.CONNECTING;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    
    // Simulate connection after a short delay
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

  static closeAll() {
    MockWebSocket.instances.forEach(ws => ws.close());
    MockWebSocket.instances = [];
  }

  static simulateMessage(message: any) {
    MockWebSocket.instances.forEach(ws => {
      if (ws.onmessage && ws.readyState === WebSocket.OPEN) {
        ws.onmessage(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
    });
  }
}

// Set up global WebSocket mock
global.WebSocket = MockWebSocket as any;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock fetch globally
global.fetch = jest.fn();

// Mock console methods to reduce test noise
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  warn: jest.fn(),
  error: jest.fn(),
  log: process.env.CI ? jest.fn() : originalConsole.log,
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  MockWebSocket.closeAll();
  localStorageMock.clear();
  sessionStorageMock.clear();
  
  // Reset fetch mock
  (global.fetch as jest.Mock).mockReset();
  
  // Default localStorage behavior for auth
  localStorageMock.getItem.mockImplementation((key: string) => {
    if (key === 'auth_token') return 'mock-test-token';
    if (key === 'auth_user') return JSON.stringify({
      id: 'test-user-id',
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      role: 'solicitor',
    });
    return null;
  });
});

// Global test utilities
global.mcpTestUtils = {
  mockWebSocket: MockWebSocket,
  
  createMockMemoryItem: (overrides = {}) => ({
    key: `test-key-${Date.now()}`,
    value: 'Test memory item',
    category: 'note' as const,
    priority: 'normal' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    role: 'solicitor' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  setupMockFetch: (responses: Record<string, any>) => {
    (global.fetch as jest.Mock).mockImplementation((url: string, _options: any = {}) => {
      // Find matching response
      const matchingKey = Object.keys(responses).find(key => url.includes(key));
      if (matchingKey) {
        const response = responses[matchingKey];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
          text: () => Promise.resolve(JSON.stringify(response)),
        });
      }

      // Default success response
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: {},
        }),
      });
    });
  },

  waitForMCPInitialization: async (timeout = 5000) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const _checkInitialization = () => {
        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }
        
        // Check if MCP contexts are initialized
        // This would be implemented based on your actual initialization logic
        setTimeout(_checkInitialization, 100);
      };
      
      // Simulate initialization completion
      setTimeout(() => resolve(true), 500);
    });
  },
};

// Add type declarations
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeVisible(): R;
    }
  }

  var mcpTestUtils: {
    mockWebSocket: typeof MockWebSocket;
    createMockMemoryItem: (overrides?: any) => any;
    createMockUser: (overrides?: any) => any;
    setupMockFetch: (responses: Record<string, any>) => void;
    waitForMCPInitialization: (timeout?: number) => Promise<boolean>;
  };
}