import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Bug, X, Trash2, Download, RefreshCw, Activity, Database, Globe, Terminal,
  Play, Pause, Radio, Settings, Save, Upload, Wifi, WifiOff, Clock
} from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface DebugPreset {
  id: string;
  name: string;
  description: string;
  settings: any;
}

export const EnhancedDebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [presets, setPresets] = useState<DebugPreset[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [realtimeLogs, setRealtimeLogs] = useState<any[]>([]);
  const [networkRequests, setNetworkRequests] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // Only render in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // WebSocket connection
  useEffect(() => {
    if (isVisible && !isMinimized) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isVisible, isMinimized]);

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/debug-ws`);

    ws.onopen = () => {
      setWsConnected(true);
      console.log('Debug WebSocket connected');
      
      // Subscribe to channels
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: ['logs', 'metrics', 'queries', 'network']
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('Debug WebSocket disconnected');
    };

    wsRef.current = ws;
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWsConnected(false);
    }
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'log':
        setRealtimeLogs(prev => [...prev.slice(-99), message]);
        break;
      case 'network':
        setNetworkRequests(prev => [...prev.slice(-49), message.data]);
        break;
      case 'recordingStarted':
        setIsRecording(true);
        toast({
          title: 'Recording Started',
          description: `Session ID: ${message.sessionId}`,
        });
        break;
      case 'recordingStopped':
        setIsRecording(false);
        toast({
          title: 'Recording Stopped',
          description: `Session saved with ${message.session.logs.length} logs`,
        });
        break;
    }
  };

  // Fetch presets
  const fetchPresets = async () => {
    try {
      const response = await fetch('/api/debug/presets');
      const data = await response.json();
      setPresets(data.presets);
      setActivePreset(data.active?.id || null);
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    }
  };

  // Activate preset
  const activatePreset = async (presetId: string) => {
    try {
      const response = await fetch(`/api/debug/presets/${presetId}/activate`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setActivePreset(presetId);
        toast({
          title: 'Preset Activated',
          description: `Debug preset "${presetId}" is now active`,
        });
      }
    } catch (error) {
      console.error('Failed to activate preset:', error);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const response = await fetch('/api/debug/recording/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Debug Session ${new Date().toLocaleString()}`,
          description: 'Manual debug recording'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      const response = await fetch('/api/debug/recording/stop', {
        method: 'POST'
      });
      
      if (response.ok) {
        setIsRecording(false);
        fetchSessions();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // Fetch sessions
  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/debug/recording/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  // Export session
  const exportSession = async (sessionId: string, format: 'json' | 'html') => {
    const url = `/api/debug/recording/sessions/${sessionId}/export?format=${format}`;
    window.open(url, '_blank');
  };

  // Initial data fetch
  useEffect(() => {
    if (isVisible && !isMinimized) {
      fetchPresets();
      fetchSessions();
    }
  }, [isVisible, isMinimized]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <>
      {/* Debug Toggle Button */}
      <Button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 rounded-full w-12 h-12 p-0"
        variant="outline"
        title="Toggle Enhanced Debug Panel (Ctrl+Shift+D)"
      >
        <Bug className="h-5 w-5" />
      </Button>

      {/* Enhanced Debug Panel */}
      {isVisible && (
        <Card className={`fixed bottom-20 right-4 z-40 shadow-2xl transition-all ${
          isMinimized ? 'w-80 h-12' : 'w-[800px] h-[600px]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              <span className="font-semibold">Enhanced Debug Panel</span>
              <Badge variant={wsConnected ? 'default' : 'secondary'}>
                {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              </Badge>
              {isRecording && (
                <Badge variant="destructive" className="animate-pulse">
                  <Radio className="h-3 w-3 mr-1" />
                  Recording
                </Badge>
              )}
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
            <Tabs defaultValue="realtime" className="flex-1 flex flex-col h-[calc(100%-60px)]">
              <TabsList className="grid w-full grid-cols-6 p-1">
                <TabsTrigger value="realtime">
                  <Radio className="h-3 w-3 mr-1" />
                  Realtime
                </TabsTrigger>
                <TabsTrigger value="network">
                  <Globe className="h-3 w-3 mr-1" />
                  Network
                </TabsTrigger>
                <TabsTrigger value="presets">
                  <Settings className="h-3 w-3 mr-1" />
                  Presets
                </TabsTrigger>
                <TabsTrigger value="recording">
                  <Play className="h-3 w-3 mr-1" />
                  Recording
                </TabsTrigger>
                <TabsTrigger value="sessions">
                  <Clock className="h-3 w-3 mr-1" />
                  Sessions
                </TabsTrigger>
                <TabsTrigger value="devtools">
                  <Terminal className="h-3 w-3 mr-1" />
                  DevTools
                </TabsTrigger>
              </TabsList>

              {/* Realtime Logs Tab */}
              <TabsContent value="realtime" className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2 p-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
                  </span>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={() => setRealtimeLogs([])}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="h-[400px] p-2">
                  <div className="space-y-1 text-xs font-mono">
                    {realtimeLogs.map((log, i) => (
                      <div key={i} className="break-all">
                        <span className="text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {' '}
                        <Badge variant={
                          log.level === 'ERROR' ? 'destructive' :
                          log.level === 'WARN' ? 'secondary' :
                          'outline'
                        } className="text-xs">
                          {log.level}
                        </Badge>
                        {' '}
                        {log.category && <span className="text-blue-500">[{log.category}]</span>}
                        {' '}
                        {log.message}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Network Tab */}
              <TabsContent value="network" className="flex-1 overflow-hidden">
                <ScrollArea className="h-[450px] p-2">
                  <div className="space-y-2">
                    {networkRequests.map((req, i) => (
                      <Card key={i} className="p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{req.method}</Badge>
                            <span className="text-sm font-mono">{req.path}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={req.status >= 400 ? 'destructive' : 'default'}>
                              {req.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {req.duration}ms
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Presets Tab */}
              <TabsContent value="presets" className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {presets.map(preset => (
                    <Card
                      key={preset.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        activePreset === preset.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => activatePreset(preset.id)}
                    >
                      <h4 className="font-semibold text-sm">{preset.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {preset.description}
                      </p>
                      {activePreset === preset.id && (
                        <Badge className="mt-2" variant="default">Active</Badge>
                      )}
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Recording Tab */}
              <TabsContent value="recording" className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Session Recording</h3>
                      <p className="text-sm text-muted-foreground">
                        Capture debug data for later analysis
                      </p>
                    </div>
                    <Button
                      onClick={isRecording ? stopRecording : startRecording}
                      variant={isRecording ? 'destructive' : 'default'}
                    >
                      {isRecording ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start Recording
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {isRecording && (
                    <Card className="p-4 bg-destructive/5 border-destructive">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-destructive animate-pulse" />
                        <span className="text-sm">Recording in progress...</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        All debug data is being captured. Stop recording to save the session.
                      </p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions" className="p-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {sessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No recorded sessions yet
                      </p>
                    ) : (
                      sessions.map(session => (
                        <Card key={session.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-sm">{session.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {new Date(session.startTime).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => exportSession(session.id, 'json')}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => exportSession(session.id, 'html')}
                              >
                                HTML
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* DevTools Tab */}
              <TabsContent value="devtools" className="p-4">
                <div className="space-y-4">
                  <Card className="p-4">
                    <h3 className="font-semibold text-sm mb-2">Browser DevTools Integration</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Enhanced debugging features are available in Chrome DevTools
                    </p>
                    <ul className="text-xs space-y-1">
                      <li>• Network timing via Server-Timing headers</li>
                      <li>• Request IDs in X-Debug-Request-Id headers</li>
                      <li>• Source maps enabled for TypeScript debugging</li>
                      <li>• Console logs forwarded to debug panel</li>
                    </ul>
                  </Card>
                  
                  <Card className="p-4">
                    <h3 className="font-semibold text-sm mb-2">Performance Metrics</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Memory:</span>
                        <span className="ml-2 font-mono">
                          {(performance as any).memory?.usedJSHeapSize 
                            ? `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB`
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">DOM Nodes:</span>
                        <span className="ml-2 font-mono">
                          {document.getElementsByTagName('*').length}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </Card>
      )}
    </>
  );
};