import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Bug, X, Trash2, Download, RefreshCw, Activity, Database, Globe, Terminal } from 'lucide-react';

interface LogEntry {
  level: string;
  message: string;
  timestamp: Date;
  data?: any;
  category?: string;
  correlationId?: string;
}

interface DebugStats {
  users: number;
  cases: number;
  documents: number;
  persons: number;
}

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  memory: any;
  system: any;
  database: string;
}

export const DebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [debugLevel, setDebugLevel] = useState<string>('INFO');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [dbStats, setDbStats] = useState<DebugStats | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [env, setEnv] = useState<Record<string, string>>({});

  // Only render in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Fetch debug logs
  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      params.append('limit', '100');

      const response = await fetch(`/api/debug/logs?${params}`);
      const data = await response.json();
      
      setLogs(data.logs || []);
      setCategories(data.categories || []);
      setDebugLevel(data.currentLevel || 'INFO');
    } catch (error) {
      console.error('Failed to fetch debug logs:', error);
    }
  }, [selectedCategory]);

  // Fetch health data
  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/debug/health');
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    }
  };

  // Fetch database stats
  const fetchDbStats = async () => {
    try {
      const response = await fetch('/api/debug/db-stats');
      const data = await response.json();
      setDbStats(data);
    } catch (error) {
      console.error('Failed to fetch database stats:', error);
    }
  };

  // Fetch routes
  const fetchRoutes = async () => {
    try {
      const response = await fetch('/api/debug/routes');
      const data = await response.json();
      setRoutes(data.routes || []);
    } catch (error) {
      console.error('Failed to fetch routes:', error);
    }
  };

  // Fetch environment variables
  const fetchEnv = async () => {
    try {
      const response = await fetch('/api/debug/env');
      const data = await response.json();
      setEnv(data);
    } catch (error) {
      console.error('Failed to fetch environment:', error);
    }
  };

  // Clear logs
  const clearLogs = async () => {
    try {
      await fetch('/api/debug/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  // Change debug level
  const changeDebugLevel = async (level: string) => {
    try {
      await fetch('/api/debug/level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      setDebugLevel(level);
      fetchLogs();
    } catch (error) {
      console.error('Failed to change debug level:', error);
    }
  };

  // Export logs
  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `debug-logs-${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Auto-refresh logs
  useEffect(() => {
    if (isVisible && !isMinimized) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [isVisible, isMinimized, fetchLogs]);

  // Initial fetch when panel opens
  useEffect(() => {
    if (isVisible && !isMinimized) {
      fetchHealth();
      fetchDbStats();
      fetchRoutes();
      fetchEnv();
    }
  }, [isVisible, isMinimized]);

  // Keyboard shortcut to toggle panel
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-red-500';
      case 'WARN': return 'text-yellow-500';
      case 'INFO': return 'text-blue-500';
      case 'DEBUG': return 'text-green-500';
      case 'TRACE': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <>
      {/* Debug Toggle Button */}
      <Button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 rounded-full w-12 h-12 p-0"
        variant="outline"
        title="Toggle Debug Panel (Ctrl+Shift+D)"
      >
        <Bug className="h-5 w-5" />
      </Button>

      {/* Debug Panel */}
      {isVisible && (
        <Card className={`fixed bottom-20 right-4 z-40 shadow-2xl transition-all ${
          isMinimized ? 'w-64 h-12' : 'w-[600px] h-[500px]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              <span className="font-semibold">Debug Panel</span>
              <Badge variant="outline">{debugLevel}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? '▲' : '▼'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsVisible(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <Tabs defaultValue="logs" className="flex-1 flex flex-col h-[calc(100%-60px)]">
              <TabsList className="grid w-full grid-cols-5 p-1">
                <TabsTrigger value="logs">
                  <Terminal className="h-3 w-3 mr-1" />
                  Logs
                </TabsTrigger>
                <TabsTrigger value="health">
                  <Activity className="h-3 w-3 mr-1" />
                  Health
                </TabsTrigger>
                <TabsTrigger value="database">
                  <Database className="h-3 w-3 mr-1" />
                  Database
                </TabsTrigger>
                <TabsTrigger value="routes">
                  <Globe className="h-3 w-3 mr-1" />
                  Routes
                </TabsTrigger>
                <TabsTrigger value="env">Env</TabsTrigger>
              </TabsList>

              {/* Logs Tab */}
              <TabsContent value="logs" className="flex-1 flex flex-col mt-2 space-y-2 overflow-hidden">
                <div className="flex items-center gap-2 px-2">
                  <Select value={debugLevel} onValueChange={changeDebugLevel}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ERROR">ERROR</SelectItem>
                      <SelectItem value="WARN">WARN</SelectItem>
                      <SelectItem value="INFO">INFO</SelectItem>
                      <SelectItem value="DEBUG">DEBUG</SelectItem>
                      <SelectItem value="TRACE">TRACE</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex-1" />

                  <Button size="sm" variant="ghost" onClick={fetchLogs}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={exportLogs}>
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearLogs}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <ScrollArea className="flex-1 px-2">
                  <div className="space-y-1 text-xs font-mono">
                    {logs.map((log, i) => (
                      <div key={i} className={`${getLevelColor(log.level)} break-all`}>
                        <span className="text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {' '}
                        <span className="font-semibold">[{log.level}]</span>
                        {log.category && <span> [{log.category}]</span>}
                        {' '}
                        {log.message}
                        {log.data && (
                          <div className="ml-4 text-gray-600">
                            {JSON.stringify(log.data, null, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Health Tab */}
              <TabsContent value="health" className="flex-1 p-4 overflow-auto">
                {health && (
                  <div className="space-y-4 text-sm">
                    <div>
                      <strong>Status:</strong> {health.status}
                    </div>
                    <div>
                      <strong>Database:</strong> {health.database}
                    </div>
                    <div>
                      <strong>Uptime:</strong> {Math.floor(health.uptime / 60)} minutes
                    </div>
                    <div>
                      <strong>Memory Usage:</strong>
                      <div className="ml-4">
                        RSS: {formatBytes(health.memory?.rss || 0)}<br />
                        Heap Used: {formatBytes(health.memory?.heapUsed || 0)}<br />
                        Heap Total: {formatBytes(health.memory?.heapTotal || 0)}
                      </div>
                    </div>
                    <div>
                      <strong>System:</strong>
                      <div className="ml-4">
                        Platform: {health.system?.platform}<br />
                        CPUs: {health.system?.cpus}<br />
                        Free Memory: {formatBytes(health.system?.freeMem || 0)}<br />
                        Total Memory: {formatBytes(health.system?.totalMem || 0)}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Database Tab */}
              <TabsContent value="database" className="flex-1 p-4">
                {dbStats && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="p-3">
                        <div className="text-sm text-gray-600">Users</div>
                        <div className="text-2xl font-bold">{dbStats.users}</div>
                      </Card>
                      <Card className="p-3">
                        <div className="text-sm text-gray-600">Cases</div>
                        <div className="text-2xl font-bold">{dbStats.cases}</div>
                      </Card>
                      <Card className="p-3">
                        <div className="text-sm text-gray-600">Documents</div>
                        <div className="text-2xl font-bold">{dbStats.documents}</div>
                      </Card>
                      <Card className="p-3">
                        <div className="text-sm text-gray-600">Persons</div>
                        <div className="text-2xl font-bold">{dbStats.persons}</div>
                      </Card>
                    </div>
                    <Button onClick={fetchDbStats} className="w-full">
                      Refresh Stats
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Routes Tab */}
              <TabsContent value="routes" className="flex-1 overflow-auto">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {routes.map((route, i) => (
                      <div key={i} className="text-xs font-mono">
                        <Badge variant="outline" className="mr-2">
                          {route.methods}
                        </Badge>
                        {route.path}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Environment Tab */}
              <TabsContent value="env" className="flex-1 overflow-auto">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {Object.entries(env).map(([key, value]) => (
                      <div key={key} className="text-xs font-mono">
                        <span className="font-semibold">{key}:</span>{' '}
                        <span className={value === '***REDACTED***' ? 'text-red-500' : ''}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </Card>
      )}
    </>
  );
};