/**
 * MCP System Status Context Manager
 * 
 * Provides React context for monitoring all MCP services including:
 * - Overall system health and performance monitoring
 * - Individual MCP service status tracking
 * - Real-time health updates and alerts
 * - Service connectivity and responsiveness monitoring
 * - Performance metrics and diagnostics
 */

import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  MCPServiceStatus,
  MCPSystemHealth,
  MCPApiResponse,
  MCPLoadingState,
  MCPErrorState,
  MCPHookOptions,
  DEFAULT_MCP_CONFIG,
} from '../types/mcp';

// Extended service status for detailed monitoring
interface ExtendedMCPServiceStatus extends MCPServiceStatus {
  history: {
    timestamp: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    error?: string;
  }[];
  metrics: {
    uptime: number;
    avgResponseTime: number;
    errorRate: number;
    lastSuccessfulCheck: string;
    totalChecks: number;
    failedChecks: number;
  };
}

// Alert configuration
interface MCPAlert {
  id: string;
  serviceId: string;
  type: 'service_down' | 'high_latency' | 'error_rate' | 'connectivity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

// Context State Interface
interface MCPSystemStatusContextState {
  // System health
  systemHealth: MCPSystemHealth;
  services: ExtendedMCPServiceStatus[];
  
  // Monitoring configuration
  checkInterval: number;
  enabledServices: string[];
  monitoringEnabled: boolean;
  
  // Alerts and notifications
  alerts: MCPAlert[];
  unacknowledgedAlerts: MCPAlert[];
  
  // Performance metrics
  systemMetrics: {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  
  // Real-time data
  realtimeEnabled: boolean;
  lastHealthCheck: string | null;
  
  // State management
  loading: MCPLoadingState;
  errors: MCPErrorState;
  connected: boolean;
}

// Action Types
type MCPSystemStatusAction =
  | { type: 'SET_LOADING'; operation: string; loading: boolean }
  | { type: 'SET_ERROR'; operation: string; error: string | null }
  | { type: 'SET_SYSTEM_HEALTH'; health: MCPSystemHealth }
  | { type: 'SET_SERVICES'; services: ExtendedMCPServiceStatus[] }
  | { type: 'UPDATE_SERVICE'; serviceId: string; updates: Partial<ExtendedMCPServiceStatus> }
  | { type: 'ADD_SERVICE_HISTORY'; serviceId: string; entry: any }
  | { type: 'SET_CHECK_INTERVAL'; interval: number }
  | { type: 'SET_ENABLED_SERVICES'; services: string[] }
  | { type: 'SET_MONITORING_ENABLED'; enabled: boolean }
  | { type: 'ADD_ALERT'; alert: MCPAlert }
  | { type: 'UPDATE_ALERT'; alertId: string; updates: Partial<MCPAlert> }
  | { type: 'REMOVE_ALERT'; alertId: string }
  | { type: 'SET_SYSTEM_METRICS'; metrics: any }
  | { type: 'SET_REALTIME_ENABLED'; enabled: boolean }
  | { type: 'SET_LAST_HEALTH_CHECK'; timestamp: string }
  | { type: 'SET_CONNECTED'; connected: boolean };

// Context Interface
interface MCPSystemStatusContextType extends MCPSystemStatusContextState {
  // Health Monitoring
  performHealthCheck: () => Promise<void>;
  performServiceCheck: (serviceId: string) => Promise<void>;
  enableMonitoring: (enabled: boolean) => void;
  setCheckInterval: (intervalMs: number) => void;
  
  // Service Management
  addService: (service: Omit<MCPServiceStatus, 'lastCheck'>) => Promise<void>;
  removeService: (serviceId: string) => Promise<void>;
  enableService: (serviceId: string, enabled: boolean) => void;
  restartService: (serviceId: string) => Promise<void>;
  
  // Alert Management
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string, resolution?: string) => Promise<void>;
  createAlert: (alert: Omit<MCPAlert, 'id' | 'timestamp' | 'acknowledged'>) => void;
  clearResolvedAlerts: () => void;
  
  // Metrics and Analytics
  getServiceMetrics: (serviceId: string, timeRange?: string) => Promise<any>;
  getSystemMetrics: (timeRange?: string) => Promise<any>;
  exportMetrics: (format?: 'json' | 'csv') => Promise<any>;
  
  // Service-specific monitoring
  checkMemoryService: () => Promise<void>;
  checkFileOperationsService: () => Promise<void>;
  checkGitService: () => Promise<void>;
  checkWorkflowService: () => Promise<void>;
  checkDatabaseService: () => Promise<void>;
  checkAIService: () => Promise<void>;
  
  // Configuration
  updateMonitoringConfig: (config: any) => Promise<void>;
  getMonitoringConfig: () => Promise<any>;
  resetServiceHistory: (serviceId?: string) => void;
  
  // Real-time Updates
  enableRealtime: (enabled: boolean) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Utility Functions
  generateHealthReport: () => Promise<any>;
  runDiagnostics: () => Promise<any>;
  clearErrors: (operation?: string) => void;
  retry: (operation: string) => Promise<void>;
}

// Initial State
const initialState: MCPSystemStatusContextState = {
  systemHealth: {
    overall: 'healthy',
    services: [],
    lastUpdate: new Date().toISOString(),
    uptime: 0,
  },
  services: [],
  checkInterval: 30000, // 30 seconds
  enabledServices: [],
  monitoringEnabled: false,
  alerts: [],
  unacknowledgedAlerts: [],
  systemMetrics: {
    totalRequests: 0,
    avgResponseTime: 0,
    errorRate: 0,
    uptime: 0,
  },
  realtimeEnabled: false,
  lastHealthCheck: null,
  loading: {},
  errors: {},
  connected: false,
};

// Default services to monitor
const DEFAULT_SERVICES: Omit<ExtendedMCPServiceStatus, 'lastCheck' | 'history' | 'metrics'>[] = [
  {
    name: 'MCP Memory Keeper',
    type: 'mcp_tool',
    status: 'unknown',
  },
  {
    name: 'MCP File Operations',
    type: 'mcp_tool',
    status: 'unknown',
  },
  {
    name: 'MCP Git Integration',
    type: 'mcp_tool',
    status: 'unknown',
  },
  {
    name: 'PostgreSQL Database',
    type: 'database',
    status: 'unknown',
  },
  {
    name: 'Redis Cache',
    type: 'database',
    status: 'unknown',
  },
  {
    name: 'File System',
    type: 'file_system',
    status: 'unknown',
  },
  {
    name: 'Ollama AI Service',
    type: 'ai_model',
    status: 'unknown',
  },
  {
    name: 'Express API Server',
    type: 'api_service',
    status: 'unknown',
  },
];

// Reducer
function mcpSystemStatusReducer(
  state: MCPSystemStatusContextState,
  action: MCPSystemStatusAction
): MCPSystemStatusContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.operation]: action.loading },
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.operation]: action.error },
      };
    
    case 'SET_SYSTEM_HEALTH':
      return { ...state, systemHealth: action.health };
    
    case 'SET_SERVICES':
      return { ...state, services: action.services };
    
    case 'UPDATE_SERVICE':
      return {
        ...state,
        services: state.services.map(service =>
          service.name === action.serviceId
            ? { ...service, ...action.updates }
            : service
        ),
      };
    
    case 'ADD_SERVICE_HISTORY':
      return {
        ...state,
        services: state.services.map(service =>
          service.name === action.serviceId
            ? {
                ...service,
                history: [action.entry, ...service.history.slice(0, 99)], // Keep last 100 entries
              }
            : service
        ),
      };
    
    case 'SET_CHECK_INTERVAL':
      return { ...state, checkInterval: action.interval };
    
    case 'SET_ENABLED_SERVICES':
      return { ...state, enabledServices: action.services };
    
    case 'SET_MONITORING_ENABLED':
      return { ...state, monitoringEnabled: action.enabled };
    
    case 'ADD_ALERT':
      return {
        ...state,
        alerts: [action.alert, ...state.alerts],
        unacknowledgedAlerts: action.alert.acknowledged
          ? state.unacknowledgedAlerts
          : [action.alert, ...state.unacknowledgedAlerts],
      };
    
    case 'UPDATE_ALERT': {
      const updatedAlerts = state.alerts.map(alert =>
        alert.id === action.alertId ? { ...alert, ...action.updates } : alert
      );
      return {
        ...state,
        alerts: updatedAlerts,
        unacknowledgedAlerts: updatedAlerts.filter(a => !a.acknowledged),
      };
    }
    
    case 'REMOVE_ALERT':
      return {
        ...state,
        alerts: state.alerts.filter(alert => alert.id !== action.alertId),
        unacknowledgedAlerts: state.unacknowledgedAlerts.filter(alert => alert.id !== action.alertId),
      };
    
    case 'SET_SYSTEM_METRICS':
      return { ...state, systemMetrics: action.metrics };
    
    case 'SET_REALTIME_ENABLED':
      return { ...state, realtimeEnabled: action.enabled };
    
    case 'SET_LAST_HEALTH_CHECK':
      return { ...state, lastHealthCheck: action.timestamp };
    
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };
    
    default:
      return state;
  }
}

// Context Creation
const MCPSystemStatusContext = createContext<MCPSystemStatusContextType | undefined>(undefined);

// Provider Component
export function MCPSystemStatusProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mcpSystemStatusReducer, initialState);
  const { token, user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // API Helper Function
  const apiCall = async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<MCPApiResponse<T>> => {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${DEFAULT_MCP_CONFIG.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { ...data, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorObject = error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) };
      throw { ...errorObject, responseTime };
    }
  };

  // Error Handler
  const handleError = (operation: string, error: any) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dispatch({ type: 'SET_ERROR', operation, error: errorMessage });
    dispatch({ type: 'SET_LOADING', operation, loading: false });

    // Create alert for critical errors
    if (['performHealthCheck', 'performServiceCheck'].includes(operation)) {
      createAlert({
        serviceId: operation,
        type: 'connectivity',
        severity: 'high',
        message: `Health check failed: ${errorMessage}`,
      });
    }
  };

  // Initialize services
  useEffect(() => {
    const initializeServices = () => {
      const initialServices: ExtendedMCPServiceStatus[] = DEFAULT_SERVICES.map(service => ({
        ...service,
        lastCheck: new Date().toISOString(),
        history: [],
        metrics: {
          uptime: 0,
          avgResponseTime: 0,
          errorRate: 0,
          lastSuccessfulCheck: new Date().toISOString(),
          totalChecks: 0,
          failedChecks: 0,
        },
      }));

      dispatch({ type: 'SET_SERVICES', services: initialServices });
      dispatch({
        type: 'SET_ENABLED_SERVICES',
        services: initialServices.map(s => s.name),
      });
    };

    if (state.services.length === 0) {
      initializeServices();
    }
  }, [state.services.length]);

  // Health Monitoring
  const performHealthCheck = async () => {
    const operation = 'performHealthCheck';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPSystemHealth>('/system/health', {
        method: 'GET',
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_SYSTEM_HEALTH', health: response.data });
        dispatch({ type: 'SET_LAST_HEALTH_CHECK', timestamp: new Date().toISOString() });

        // Update individual service statuses
        response.data.services.forEach(serviceStatus => {
          const existingService = state.services.find(s => s.name === serviceStatus.name);
          if (existingService) {
            const historyEntry = {
              timestamp: new Date().toISOString(),
              status: serviceStatus.status,
              responseTime: serviceStatus.responseTime,
              error: serviceStatus.error,
            };

            // Update metrics
            const updatedMetrics = {
              ...existingService.metrics,
              totalChecks: existingService.metrics.totalChecks + 1,
              failedChecks: serviceStatus.status === 'healthy'
                ? existingService.metrics.failedChecks
                : existingService.metrics.failedChecks + 1,
              lastSuccessfulCheck: serviceStatus.status === 'healthy'
                ? new Date().toISOString()
                : existingService.metrics.lastSuccessfulCheck,
            };

            // Calculate average response time
            if (serviceStatus.responseTime) {
              const totalResponseTime = existingService.metrics.avgResponseTime * (updatedMetrics.totalChecks - 1);
              updatedMetrics.avgResponseTime = (totalResponseTime + serviceStatus.responseTime) / updatedMetrics.totalChecks;
            }

            // Calculate error rate
            updatedMetrics.errorRate = (updatedMetrics.failedChecks / updatedMetrics.totalChecks) * 100;

            dispatch({
              type: 'UPDATE_SERVICE',
              serviceId: serviceStatus.name,
              updates: {
                status: serviceStatus.status,
                lastCheck: new Date().toISOString(),
                responseTime: serviceStatus.responseTime,
                error: serviceStatus.error,
                metrics: updatedMetrics,
              },
            });

            dispatch({
              type: 'ADD_SERVICE_HISTORY',
              serviceId: serviceStatus.name,
              entry: historyEntry,
            });

            // Create alerts for service issues
            if (serviceStatus.status === 'unhealthy') {
              createAlert({
                serviceId: serviceStatus.name,
                type: 'service_down',
                severity: 'critical',
                message: `Service ${serviceStatus.name} is unhealthy: ${serviceStatus.error}`,
              });
            } else if (serviceStatus.status === 'degraded') {
              createAlert({
                serviceId: serviceStatus.name,
                type: 'high_latency',
                severity: 'medium',
                message: `Service ${serviceStatus.name} is experiencing degraded performance`,
              });
            }
          }
        });
      }
    } catch (error) {
      handleError(operation, error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const performServiceCheck = async (serviceId: string) => {
    const operation = `performServiceCheck-${serviceId}`;
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<MCPServiceStatus>('/system/service-health', {
        method: 'POST',
        body: JSON.stringify({ serviceId }),
      });

      if (response.success && response.data) {
        const serviceStatus = response.data;
        const existingService = state.services.find(s => s.name === serviceId);
        
        if (existingService) {
          const historyEntry = {
            timestamp: new Date().toISOString(),
            status: serviceStatus.status,
            responseTime: serviceStatus.responseTime,
            error: serviceStatus.error,
          };

          dispatch({
            type: 'UPDATE_SERVICE',
            serviceId,
            updates: {
              status: serviceStatus.status,
              lastCheck: new Date().toISOString(),
              responseTime: serviceStatus.responseTime,
              error: serviceStatus.error,
            },
          });

          dispatch({
            type: 'ADD_SERVICE_HISTORY',
            serviceId,
            entry: historyEntry,
          });
        }
      }
    } catch (error) {
      handleError(operation, error);
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const enableMonitoring = (enabled: boolean) => {
    dispatch({ type: 'SET_MONITORING_ENABLED', enabled });

    if (enabled) {
      // Start health check interval
      healthCheckIntervalRef.current = setInterval(performHealthCheck, state.checkInterval);
      performHealthCheck(); // Immediate check
    } else {
      // Stop health check interval
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    }
  };

  const setCheckInterval = (intervalMs: number) => {
    dispatch({ type: 'SET_CHECK_INTERVAL', interval: intervalMs });

    // Restart monitoring with new interval if enabled
    if (state.monitoringEnabled) {
      enableMonitoring(false);
      enableMonitoring(true);
    }
  };

  // Service Management
  const addService = async (service: Omit<MCPServiceStatus, 'lastCheck'>) => {
    const operation = 'addService';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const newService: ExtendedMCPServiceStatus = {
        ...service,
        lastCheck: new Date().toISOString(),
        history: [],
        metrics: {
          uptime: 0,
          avgResponseTime: 0,
          errorRate: 0,
          lastSuccessfulCheck: new Date().toISOString(),
          totalChecks: 0,
          failedChecks: 0,
        },
      };

      dispatch({ type: 'SET_SERVICES', services: [...state.services, newService] });
      dispatch({
        type: 'SET_ENABLED_SERVICES',
        services: [...state.enabledServices, service.name],
      });
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const removeService = async (serviceId: string) => {
    const operation = 'removeService';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      dispatch({
        type: 'SET_SERVICES',
        services: state.services.filter(s => s.name !== serviceId),
      });
      dispatch({
        type: 'SET_ENABLED_SERVICES',
        services: state.enabledServices.filter(id => id !== serviceId),
      });
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const enableService = (serviceId: string, enabled: boolean) => {
    const currentEnabled = state.enabledServices.includes(serviceId);
    
    if (enabled && !currentEnabled) {
      dispatch({
        type: 'SET_ENABLED_SERVICES',
        services: [...state.enabledServices, serviceId],
      });
    } else if (!enabled && currentEnabled) {
      dispatch({
        type: 'SET_ENABLED_SERVICES',
        services: state.enabledServices.filter(id => id !== serviceId),
      });
    }
  };

  const restartService = async (serviceId: string) => {
    const operation = 'restartService';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/system/restart-service', {
        method: 'POST',
        body: JSON.stringify({ serviceId }),
      });

      if (response.success) {
        // Force a service check after restart
        await performServiceCheck(serviceId);
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Alert Management
  const acknowledgeAlert = async (alertId: string) => {
    const operation = 'acknowledgeAlert';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      dispatch({
        type: 'UPDATE_ALERT',
        alertId,
        updates: { acknowledged: true },
      });
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const resolveAlert = async (alertId: string, _resolution?: string) => {
    const operation = 'resolveAlert';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      dispatch({
        type: 'UPDATE_ALERT',
        alertId,
        updates: {
          acknowledged: true,
          resolvedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const createAlert = (alert: Omit<MCPAlert, 'id' | 'timestamp' | 'acknowledged'>) => {
    const newAlert: MCPAlert = {
      ...alert,
      id: Date.now().toString() + Math.random().toString(36),
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    dispatch({ type: 'ADD_ALERT', alert: newAlert });
  };

  const clearResolvedAlerts = () => {
    const _unresolvedAlerts = state.alerts.filter(alert => !alert.resolvedAt);
    dispatch({ type: 'SET_SERVICES', services: state.services }); // Trigger re-render
    state.alerts.filter(alert => alert.resolvedAt).forEach(alert => {
      dispatch({ type: 'REMOVE_ALERT', alertId: alert.id });
    });
  };

  // Metrics and Analytics
  const getServiceMetrics = async (serviceId: string, timeRange = '24h'): Promise<any> => {
    const operation = 'getServiceMetrics';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/system/metrics/service', {
        method: 'POST',
        body: JSON.stringify({ serviceId, timeRange }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const getSystemMetrics = async (timeRange = '24h'): Promise<any> => {
    const operation = 'getSystemMetrics';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/system/metrics', {
        method: 'POST',
        body: JSON.stringify({ timeRange }),
      });

      if (response.success && response.data) {
        dispatch({ type: 'SET_SYSTEM_METRICS', metrics: response.data });
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const exportMetrics = async (format: 'json' | 'csv' = 'json'): Promise<any> => {
    const operation = 'exportMetrics';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/system/metrics/export', {
        method: 'POST',
        body: JSON.stringify({ format }),
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  // Service-specific monitoring
  const checkMemoryService = async () => {
    await performServiceCheck('MCP Memory Keeper');
  };

  const checkFileOperationsService = async () => {
    await performServiceCheck('MCP File Operations');
  };

  const checkGitService = async () => {
    await performServiceCheck('MCP Git Integration');
  };

  const checkWorkflowService = async () => {
    await performServiceCheck('MCP Workflow Service');
  };

  const checkDatabaseService = async () => {
    await performServiceCheck('PostgreSQL Database');
  };

  const checkAIService = async () => {
    await performServiceCheck('Ollama AI Service');
  };

  // Configuration
  const updateMonitoringConfig = async (config: any) => {
    const operation = 'updateMonitoringConfig';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall('/system/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      });

      if (response.success) {
        // Apply configuration changes
        if (config.checkInterval) {
          setCheckInterval(config.checkInterval);
        }
        if (typeof config.monitoringEnabled === 'boolean') {
          enableMonitoring(config.monitoringEnabled);
        }
      }
    } catch (error) {
      handleError(operation, error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const getMonitoringConfig = async (): Promise<any> => {
    const operation = 'getMonitoringConfig';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/system/config', {
        method: 'GET',
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const resetServiceHistory = (serviceId?: string) => {
    if (serviceId) {
      dispatch({
        type: 'UPDATE_SERVICE',
        serviceId,
        updates: {
          history: [],
          metrics: {
            uptime: 0,
            avgResponseTime: 0,
            errorRate: 0,
            lastSuccessfulCheck: new Date().toISOString(),
            totalChecks: 0,
            failedChecks: 0,
          },
        },
      });
    } else {
      // Reset all services
      const resetServices = state.services.map(service => ({
        ...service,
        history: [],
        metrics: {
          uptime: 0,
          avgResponseTime: 0,
          errorRate: 0,
          lastSuccessfulCheck: new Date().toISOString(),
          totalChecks: 0,
          failedChecks: 0,
        },
      }));
      dispatch({ type: 'SET_SERVICES', services: resetServices });
    }
  };

  // Real-time Updates
  const enableRealtime = (enabled: boolean) => {
    dispatch({ type: 'SET_REALTIME_ENABLED', enabled });
    
    if (enabled && !state.connected) {
      connect();
    } else if (!enabled && state.connected) {
      disconnect();
    }
  };

  const connect = async () => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${DEFAULT_MCP_CONFIG.websocketUrl}/system`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        dispatch({ type: 'SET_CONNECTED', connected: true });
        ws.send(JSON.stringify({
          type: 'auth',
          token,
          userId: user?.id,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'health_update':
              dispatch({ type: 'SET_SYSTEM_HEALTH', health: message.data });
              break;
            
            case 'service_status_update':
              dispatch({
                type: 'UPDATE_SERVICE',
                serviceId: message.data.serviceId,
                updates: message.data.status,
              });
              break;
            
            case 'new_alert':
              dispatch({ type: 'ADD_ALERT', alert: message.data });
              break;
            
            case 'metrics_update':
              dispatch({ type: 'SET_SYSTEM_METRICS', metrics: message.data });
              break;
          }
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        dispatch({ type: 'SET_CONNECTED', connected: false });
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    dispatch({ type: 'SET_CONNECTED', connected: false });
  };

  // Utility Functions
  const generateHealthReport = async (): Promise<any> => {
    const operation = 'generateHealthReport';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/system/health-report', {
        method: 'GET',
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const runDiagnostics = async (): Promise<any> => {
    const operation = 'runDiagnostics';
    dispatch({ type: 'SET_LOADING', operation, loading: true });
    dispatch({ type: 'SET_ERROR', operation, error: null });

    try {
      const response = await apiCall<any>('/system/diagnostics', {
        method: 'POST',
      });

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      handleError(operation, error);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', operation, loading: false });
    }
  };

  const clearErrors = (operation?: string) => {
    if (operation) {
      dispatch({ type: 'SET_ERROR', operation, error: null });
    } else {
      Object.keys(state.errors).forEach(op => {
        dispatch({ type: 'SET_ERROR', operation: op, error: null });
      });
    }
  };

  const retry = async (operation: string) => {
    switch (operation) {
      case 'performHealthCheck':
        await performHealthCheck();
        break;
      case 'getSystemMetrics':
        await getSystemMetrics();
        break;
      default:
        console.warn(`Retry not implemented for operation: ${operation}`);
    }
  };

  // Effects
  useEffect(() => {
    if (token && user) {
      performHealthCheck();
      if (DEFAULT_MCP_CONFIG.enableRealtime) {
        enableRealtime(true);
      }
    }

    return () => {
      disconnect();
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [token, user]);

  // Context value
  const contextValue: MCPSystemStatusContextType = {
    ...state,
    performHealthCheck,
    performServiceCheck,
    enableMonitoring,
    setCheckInterval,
    addService,
    removeService,
    enableService,
    restartService,
    acknowledgeAlert,
    resolveAlert,
    createAlert,
    clearResolvedAlerts,
    getServiceMetrics,
    getSystemMetrics,
    exportMetrics,
    checkMemoryService,
    checkFileOperationsService,
    checkGitService,
    checkWorkflowService,
    checkDatabaseService,
    checkAIService,
    updateMonitoringConfig,
    getMonitoringConfig,
    resetServiceHistory,
    enableRealtime,
    connect,
    disconnect,
    generateHealthReport,
    runDiagnostics,
    clearErrors,
    retry,
  };

  return (
    <MCPSystemStatusContext.Provider value={contextValue}>
      {children}
    </MCPSystemStatusContext.Provider>
  );
}

// Hook
export function useMCPSystemStatus(options: MCPHookOptions = {}) {
  const context = useContext(MCPSystemStatusContext);
  if (!context) {
    throw new Error('useMCPSystemStatus must be used within an MCPSystemStatusProvider');
  }

  const { onError, onSuccess: _onSuccess, autoRefresh, pollInterval } = options;

  // Handle errors
  useEffect(() => {
    if (onError) {
      Object.entries(context.errors).forEach(([operation, error]) => {
        if (error) {
          onError(new Error(`${operation}: ${error}`));
        }
      });
    }
  }, [context.errors, onError]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh && pollInterval && !context.monitoringEnabled) {
      const interval = setInterval(() => {
        context.performHealthCheck();
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, pollInterval, context]);

  return context;
}