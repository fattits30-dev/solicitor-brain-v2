/**
 * MCP Provider - Master Provider for All MCP Contexts
 * 
 * Provides a single provider component that combines all MCP contexts with:
 * - Integrated context management
 * - Centralized error handling and recovery
 * - Real-time updates coordination
 * - Authentication integration
 * - Performance optimization
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AuthProvider } from './AuthContext';
import { GlobalHotkeyProvider } from './GlobalHotkeyContext';
import { MCPMemoryProvider } from './MCPMemoryContext';
import { MCPFileOperationsProvider } from './MCPFileOperationsContext';
import { MCPGitProvider } from './MCPGitContext';
import { MCPWorkflowProvider } from './MCPWorkflowContext';
import { MCPSystemStatusProvider } from './MCPSystemStatusContext';
import { useMCPIntegration } from '../hooks/useMCPIntegration';
import { DEFAULT_MCP_CONFIG as _DEFAULT_MCP_CONFIG } from '../types/mcp';

// MCP Provider Configuration
interface MCPProviderConfig {
  // Feature flags
  enableMemory: boolean;
  enableFiles: boolean;
  enableGit: boolean;
  enableWorkflow: boolean;
  enableSystemStatus: boolean;
  enableRealtime: boolean;
  
  // Performance settings
  enableCaching: boolean;
  cacheTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  
  // Development settings
  enableDebugMode: boolean;
  enableDevTools: boolean;
  mockServices: boolean;
}

// Default configuration
const DEFAULT_MCP_PROVIDER_CONFIG: MCPProviderConfig = {
  enableMemory: true,
  enableFiles: true,
  enableGit: true,
  enableWorkflow: true,
  enableSystemStatus: true,
  enableRealtime: true,
  enableCaching: true,
  cacheTimeout: 300000, // 5 minutes
  retryAttempts: 3,
  retryDelay: 1000,
  enableDebugMode: process.env.NODE_ENV === 'development',
  enableDevTools: process.env.NODE_ENV === 'development',
  mockServices: false,
};

// MCP Provider Context for configuration and status
interface MCPProviderContextType {
  config: MCPProviderConfig;
  updateConfig: (updates: Partial<MCPProviderConfig>) => void;
  isInitialized: boolean;
  initializationProgress: {
    memory: boolean;
    files: boolean;
    git: boolean;
    workflow: boolean;
    system: boolean;
  };
  globalError: string | null;
  clearGlobalError: () => void;
  reinitialize: () => Promise<void>;
}

const MCPProviderContext = createContext<MCPProviderContextType | undefined>(undefined);

// Hook to access MCP Provider context
export function useMCPProvider() {
  const context = useContext(MCPProviderContext);
  if (!context) {
    throw new Error('useMCPProvider must be used within an MCPProvider');
  }
  return context;
}

// MCP Services Status Component
function MCPServicesStatus({ config }: { config: MCPProviderConfig }) {
  const integration = useMCPIntegration({
    autoRefresh: true,
    pollInterval: 10000, // 10 seconds
  });

  // Global error handling
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global MCP Error:', event.error);
      // Could dispatch to error reporting service here
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection in MCP:', event.reason);
    };

    if (config.enableDebugMode) {
      window.addEventListener('error', handleGlobalError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleGlobalError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, [config.enableDebugMode]);

  // Real-time connection management
  useEffect(() => {
    if (config.enableRealtime && integration.isConnected === false) {
      const connectWithRetry = async () => {
        for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
          try {
            await integration.connectAll();
            console.log('MCP real-time connections established');
            break;
          } catch (error) {
            console.warn(`MCP connection attempt ${attempt} failed:`, error);
            if (attempt < config.retryAttempts) {
              await new Promise(resolve => setTimeout(resolve, config.retryDelay * attempt));
            }
          }
        }
      };

      const timeoutId = setTimeout(connectWithRetry, 1000); // Delay initial connection
      return () => clearTimeout(timeoutId);
    }
  }, [config.enableRealtime, config.retryAttempts, config.retryDelay, integration]);

  // Debug mode logging
  useEffect(() => {
    if (config.enableDebugMode) {
      console.log('MCP Integration Status:', {
        isLoading: integration.isLoading,
        hasErrors: integration.hasErrors,
        isConnected: integration.isConnected,
        healthSummary: integration.healthSummary,
      });
    }
  }, [
    config.enableDebugMode,
    integration.isLoading,
    integration.hasErrors,
    integration.isConnected,
    integration.healthSummary,
  ]);

  return null; // This is a logic-only component
}

// Individual Provider Wrapper Components
function ConditionalMemoryProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  if (!enabled) return <>{children}</>;
  return <MCPMemoryProvider>{children}</MCPMemoryProvider>;
}

function ConditionalFileOperationsProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  if (!enabled) return <>{children}</>;
  return <MCPFileOperationsProvider>{children}</MCPFileOperationsProvider>;
}

function ConditionalGitProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  if (!enabled) return <>{children}</>;
  return <MCPGitProvider>{children}</MCPGitProvider>;
}

function ConditionalWorkflowProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  if (!enabled) return <>{children}</>;
  return <MCPWorkflowProvider>{children}</MCPWorkflowProvider>;
}

function ConditionalSystemStatusProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  if (!enabled) return <>{children}</>;
  return <MCPSystemStatusProvider>{children}</MCPSystemStatusProvider>;
}

// Main MCP Provider Component
function MCPProviderCore({ children, config }: { children: React.ReactNode; config: MCPProviderConfig }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationProgress, setInitializationProgress] = useState({
    memory: false,
    files: false,
    git: false,
    workflow: false,
    system: false,
  });
  const [globalError, setGlobalError] = useState<string | null>(null);
  const initializationRef = useRef<boolean>(false);

  const updateConfig = (updates: Partial<MCPProviderConfig>) => {
    // Configuration updates would be handled at the parent level
    console.log('Config update requested:', updates);
  };

  const clearGlobalError = () => {
    setGlobalError(null);
  };

  const reinitialize = async () => {
    setIsInitialized(false);
    setInitializationProgress({
      memory: false,
      files: false,
      git: false,
      workflow: false,
      system: false,
    });
    initializationRef.current = false;
    // Re-initialization logic would trigger re-mounting of providers
  };

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      if (initializationRef.current) return;
      initializationRef.current = true;

      try {
        // Initialize services in order of dependency
        if (config.enableSystemStatus) {
          setInitializationProgress(prev => ({ ...prev, system: true }));
        }

        if (config.enableMemory) {
          setInitializationProgress(prev => ({ ...prev, memory: true }));
        }

        if (config.enableFiles) {
          setInitializationProgress(prev => ({ ...prev, files: true }));
        }

        if (config.enableGit) {
          setInitializationProgress(prev => ({ ...prev, git: true }));
        }

        if (config.enableWorkflow) {
          setInitializationProgress(prev => ({ ...prev, workflow: true }));
        }

        setIsInitialized(true);

        if (config.enableDebugMode) {
          console.log('MCP Provider initialized successfully');
        }
      } catch (error) {
        setGlobalError(error instanceof Error ? error.message : 'Initialization failed');
        console.error('MCP Provider initialization failed:', error);
      }
    };

    initializeServices();
  }, [config]);

  const contextValue: MCPProviderContextType = {
    config,
    updateConfig,
    isInitialized,
    initializationProgress,
    globalError,
    clearGlobalError,
    reinitialize,
  };

  return (
    <MCPProviderContext.Provider value={contextValue}>
      <ConditionalSystemStatusProvider enabled={config.enableSystemStatus}>
        <ConditionalMemoryProvider enabled={config.enableMemory}>
          <ConditionalFileOperationsProvider enabled={config.enableFiles}>
            <ConditionalGitProvider enabled={config.enableGit}>
              <ConditionalWorkflowProvider enabled={config.enableWorkflow}>
                <MCPServicesStatus config={config} />
                {children}
              </ConditionalWorkflowProvider>
            </ConditionalGitProvider>
          </ConditionalFileOperationsProvider>
        </ConditionalMemoryProvider>
      </ConditionalSystemStatusProvider>
    </MCPProviderContext.Provider>
  );
}

// Main MCP Provider Export
interface MCPProviderProps {
  children: React.ReactNode;
  config?: Partial<MCPProviderConfig>;
}

export function MCPProvider({ children, config: configOverrides = {} }: MCPProviderProps) {
  const [config] = useState<MCPProviderConfig>({
    ...DEFAULT_MCP_PROVIDER_CONFIG,
    ...configOverrides,
  });

  return (
    <AuthProvider>
      <GlobalHotkeyProvider>
        <MCPProviderCore config={config}>
          {children}
        </MCPProviderCore>
      </GlobalHotkeyProvider>
    </AuthProvider>
  );
}

// Development Tools Component (only renders in development)
export function MCPDevTools() {
  const provider = useMCPProvider();
  
  if (!provider.config.enableDevTools || process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999,
        maxWidth: '300px',
      }}
    >
      <div><strong>MCP Dev Tools</strong></div>
      <div>Initialized: {provider.isInitialized ? '✅' : '❌'}</div>
      <div>Global Error: {provider.globalError || 'None'}</div>
      <div><strong>Services:</strong></div>
      <div>
        {Object.entries(provider.initializationProgress).map(([service, status]) => (
          <div key={service}>
            {service}: {status ? '✅' : '❌'}
          </div>
        ))}
      </div>
      {provider.globalError && (
        <button
          onClick={provider.clearGlobalError}
          style={{
            marginTop: '5px',
            padding: '2px 5px',
            fontSize: '10px',
            background: '#ff4444',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          Clear Error
        </button>
      )}
    </div>
  );
}

// Error Boundary for MCP Operations
export class MCPErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MCP Error Boundary caught an error:', error, errorInfo);
    
    // Report to error tracking service
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'exception', {
        description: error.toString(),
        fatal: false,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ 
          padding: '20px', 
          margin: '20px', 
          border: '1px solid #ff4444', 
          borderRadius: '5px',
          background: '#fff5f5',
          color: '#cc0000',
        }}>
          <h2>MCP Integration Error</h2>
          <p>Something went wrong with the MCP integration. Please try refreshing the page.</p>
          <details style={{ marginTop: '10px' }}>
            <summary>Error details</summary>
            <pre style={{ 
              marginTop: '10px', 
              padding: '10px', 
              background: '#f5f5f5', 
              fontSize: '12px',
              overflow: 'auto',
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Complete App Provider with Error Boundary
export function MCPAppProvider({ children, config }: MCPProviderProps) {
  return (
    <MCPErrorBoundary>
      <MCPProvider config={config}>
        {children}
        <MCPDevTools />
      </MCPProvider>
    </MCPErrorBoundary>
  );
}

export default MCPProvider;