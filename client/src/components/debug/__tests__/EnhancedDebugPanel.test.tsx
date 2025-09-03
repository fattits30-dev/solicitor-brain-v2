import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedDebugPanel } from '../EnhancedDebugPanel';

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  
  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen(new Event('open'));
    }, 0);
  }
  
  send(data: string) {
    // Mock send
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket;

// Mock fetch
global.fetch = jest.fn();

// Mock toast hook
jest.mock('../../ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe('EnhancedDebugPanel', () => {
  beforeEach(() => {
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    
    // Set development environment
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not render in production', () => {
    process.env.NODE_ENV = 'production';
    const { container } = render(<EnhancedDebugPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('should render toggle button in development', () => {
    render(<EnhancedDebugPanel />);
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    expect(toggleButton).toBeInTheDocument();
  });

  it('should show panel when toggle button is clicked', () => {
    render(<EnhancedDebugPanel />);
    
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Enhanced Debug Panel')).toBeInTheDocument();
  });

  it('should connect to WebSocket when panel is opened', async () => {
    const wsSpy = jest.spyOn(global, 'WebSocket' as any);
    
    render(<EnhancedDebugPanel />);
    
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(wsSpy).toHaveBeenCalledWith(expect.stringContaining('/debug-ws'));
    });
  });

  it('should display all tabs', () => {
    render(<EnhancedDebugPanel />);
    
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Realtime')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Presets')).toBeInTheDocument();
    expect(screen.getByText('Recording')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('DevTools')).toBeInTheDocument();
  });

  it('should fetch presets when panel is opened', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        presets: [
          {
            id: 'development',
            name: 'Development Mode',
            description: 'Balanced logging for development'
          }
        ],
        active: null
      })
    });
    
    render(<EnhancedDebugPanel />);
    
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/debug/presets');
    });
  });

  it('should handle recording start and stop', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presets: [], active: null })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-123' })
      });
    
    render(<EnhancedDebugPanel />);
    
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    fireEvent.click(toggleButton);
    
    // Switch to Recording tab
    const recordingTab = screen.getByText('Recording');
    fireEvent.click(recordingTab);
    
    // Click start recording
    const startButton = await screen.findByText('Start Recording');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/debug/recording/start',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });

  it('should minimize and restore panel', () => {
    render(<EnhancedDebugPanel />);
    
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    fireEvent.click(toggleButton);
    
    // Panel should be visible
    expect(screen.getByText('Enhanced Debug Panel')).toBeInTheDocument();
    expect(screen.getByText('Realtime')).toBeInTheDocument();
    
    // Find minimize button (▼)
    const minimizeButton = screen.getByText('▼');
    fireEvent.click(minimizeButton);
    
    // Tabs should be hidden when minimized
    expect(screen.queryByText('Realtime')).not.toBeInTheDocument();
    
    // Find restore button (▲)
    const restoreButton = screen.getByText('▲');
    fireEvent.click(restoreButton);
    
    // Tabs should be visible again
    expect(screen.getByText('Realtime')).toBeInTheDocument();
  });

  it('should close panel when X button is clicked', () => {
    render(<EnhancedDebugPanel />);
    
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    fireEvent.click(toggleButton);
    
    // Panel should be visible
    expect(screen.getByText('Enhanced Debug Panel')).toBeInTheDocument();
    
    // Find close button (X icon)
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => 
      btn.querySelector('svg.lucide-x')
    );
    
    if (closeButton) {
      fireEvent.click(closeButton);
    }
    
    // Panel should be hidden
    expect(screen.queryByText('Enhanced Debug Panel')).not.toBeInTheDocument();
  });

  it('should handle WebSocket messages', async () => {
    let wsInstance: MockWebSocket | null = null;
    
    jest.spyOn(global, 'WebSocket' as any).mockImplementation((...args: any[]) => {
      const url = args[0] as string;
      wsInstance = new MockWebSocket(url);
      return wsInstance;
    });
    
    render(<EnhancedDebugPanel />);
    
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(wsInstance).not.toBeNull();
    });
    
    // Simulate receiving a log message
    if (wsInstance && (wsInstance as any).onmessage) {
      (wsInstance as any).onmessage(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'log',
          level: 'INFO',
          message: 'Test log message',
          timestamp: new Date().toISOString()
        })
      }));
    }
    
    // The log should appear in the realtime tab
    await waitFor(() => {
      expect(screen.getByText(/Test log message/)).toBeInTheDocument();
    });
  });

  it('should toggle connection status indicator', async () => {
    let wsInstance: MockWebSocket | null = null;
    
    jest.spyOn(global, 'WebSocket' as any).mockImplementation((...args: any[]) => {
      const url = args[0] as string;
      wsInstance = new MockWebSocket(url);
      return wsInstance;
    });
    
    render(<EnhancedDebugPanel />);
    
    const toggleButton = screen.getByTitle(/Toggle Enhanced Debug Panel/);
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(wsInstance).not.toBeNull();
    });
    
    // Should show connected status (Wifi icon)
    const wifiIcon = document.querySelector('.lucide-wifi');
    expect(wifiIcon).toBeInTheDocument();
    
    // Simulate disconnection
    if (wsInstance) {
      (wsInstance as any).close();
    }
    
    // Should show disconnected status (WifiOff icon)
    await waitFor(() => {
      const wifiOffIcon = document.querySelector('.lucide-wifi-off');
      expect(wifiOffIcon).toBeInTheDocument();
    });
  });

  it('should respond to keyboard shortcut', () => {
    render(<EnhancedDebugPanel />);
    
    // Panel should not be visible initially
    expect(screen.queryByText('Enhanced Debug Panel')).not.toBeInTheDocument();
    
    // Trigger keyboard shortcut (Ctrl+Shift+D)
    fireEvent.keyDown(window, {
      key: 'D',
      ctrlKey: true,
      shiftKey: true
    });
    
    // Panel should become visible
    expect(screen.getByText('Enhanced Debug Panel')).toBeInTheDocument();
    
    // Trigger again to hide
    fireEvent.keyDown(window, {
      key: 'D',
      ctrlKey: true,
      shiftKey: true
    });
    
    // Panel should be hidden
    expect(screen.queryByText('Enhanced Debug Panel')).not.toBeInTheDocument();
  });
});