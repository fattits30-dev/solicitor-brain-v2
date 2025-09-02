import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Download, 
  Filter, 
  RefreshCw, 
  AlertCircle, 
  Info, 
  ShieldAlert,
  Calendar,
  User,
  Database,
  Activity
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: string;
  metadata?: {
    eventType?: string;
    severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    result?: 'SUCCESS' | 'FAILURE';
    ipAddress?: string;
    userAgent?: string;
    details?: any;
  };
}

interface AuditReport {
  entries: AuditLogEntry[];
  summary: {
    total: number;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
    byUser: Record<string, number>;
    byHour: Record<string, number>;
  };
}

interface AuditStats {
  last24Hours: {
    total: number;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
  };
  last7Days: {
    total: number;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
  };
  last30Days: {
    total: number;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
  };
}

export function AuditLogViewer() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Filters
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    resource: '',
    severity: '',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });

  const fetchAuditLogs = useCallback(async (page = 1, appliedFilters = filters) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
        ...(appliedFilters.userId && { userId: appliedFilters.userId }),
        ...(appliedFilters.action && { action: appliedFilters.action }),
        ...(appliedFilters.resource && { resource: appliedFilters.resource }),
        ...(appliedFilters.severity && { severity: appliedFilters.severity }),
        ...(appliedFilters.startDate && { startDate: new Date(appliedFilters.startDate).toISOString() }),
        ...(appliedFilters.endDate && { endDate: new Date(appliedFilters.endDate).toISOString() })
      });

      const response = await fetch(`/api/audit?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAuditLogs(data.entries || []);
      setTotalCount(data.total || 0);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize]);

  const fetchAuditStats = useCallback(async () => {
    try {
      const response = await fetch('/api/audit/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const stats = await response.json();
        setAuditStats(stats);
      }
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
    }
  }, []);

  const generateReport = async (format: 'json' | 'csv' = 'json') => {
    if (!filters.startDate || !filters.endDate) {
      setError('Start and end dates are required for report generation');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: new Date(filters.startDate).toISOString(),
        endDate: new Date(filters.endDate).toISOString(),
        format,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.resource && { resource: filters.resource }),
        ...(filters.action && { action: filters.action })
      });

      const response = await fetch(`/api/audit/report?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-report-${filters.startDate}-${filters.endDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const report: AuditReport = await response.json();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-report-${filters.startDate}-${filters.endDate}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchAuditStats();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setCurrentPage(1);
    fetchAuditLogs(1, filters);
  };

  const resetFilters = () => {
    const resetFilters = {
      userId: '',
      action: '',
      resource: '',
      severity: '',
      startDate: '',
      endDate: '',
      searchTerm: ''
    };
    setFilters(resetFilters);
    fetchAuditLogs(1, resetFilters);
  };

  const getSeverityBadge = (severity?: string) => {
    const severityConfig = {
      INFO: { variant: 'secondary' as const, icon: Info },
      WARNING: { variant: 'destructive' as const, icon: AlertCircle },
      ERROR: { variant: 'destructive' as const, icon: ShieldAlert },
      CRITICAL: { variant: 'destructive' as const, icon: ShieldAlert }
    };

    const config = severityConfig[severity as keyof typeof severityConfig];
    if (!config) return null;

    const IconComponent = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <IconComponent className="w-3 h-3" />
        {severity}
      </Badge>
    );
  };

  const getActionBadge = (action: string, result?: string) => {
    const isFailure = result === 'FAILURE';
    return (
      <Badge variant={isFailure ? 'destructive' : 'default'}>
        {action}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-UK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Audit Log Viewer</h2>
        <div className="flex gap-2">
          <Button onClick={() => fetchAuditLogs(currentPage)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <Input
                  placeholder="User ID"
                  value={filters.userId}
                  onChange={(e) => handleFilterChange('userId', e.target.value)}
                />
                <Input
                  placeholder="Action"
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                />
                <Select value={filters.resource} onValueChange={(value) => handleFilterChange('resource', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Resource" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Resources</SelectItem>
                    <SelectItem value="cases">Cases</SelectItem>
                    <SelectItem value="documents">Documents</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="authentication">Authentication</SelectItem>
                    <SelectItem value="export">Exports</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.severity} onValueChange={(value) => handleFilterChange('severity', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Severities</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="datetime-local"
                  placeholder="Start Date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
                <Input
                  type="datetime-local"
                  placeholder="End Date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={applyFilters} disabled={loading}>
                    <Search className="w-4 h-4 mr-2" />
                    Apply
                  </Button>
                  <Button variant="outline" onClick={resetFilters}>
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Entries ({totalCount} total)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading audit logs...</div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono text-sm">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                          {entry.metadata?.severity && getSeverityBadge(entry.metadata.severity)}
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{entry.userId}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-muted-foreground" />
                          {getActionBadge(entry.action, entry.metadata?.result)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-muted-foreground" />
                          <Badge variant="outline">{entry.resource}</Badge>
                        </div>
                        {entry.resourceId && (
                          <span className="text-sm text-muted-foreground">
                            ID: {entry.resourceId}
                          </span>
                        )}
                      </div>
                      
                      {entry.metadata?.details && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-medium">
                            View Details
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify(entry.metadata.details, null, 2)}
                          </pre>
                        </details>
                      )}
                      
                      {entry.metadata?.ipAddress && (
                        <div className="text-xs text-muted-foreground">
                          IP: {entry.metadata.ipAddress}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {auditLogs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No audit logs found matching the current filters.
                    </div>
                  )}
                </div>
              )}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({totalCount} total entries)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAuditLogs(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAuditLogs(currentPage + 1)}
                      disabled={currentPage === totalPages || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {auditStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Last 24 Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditStats.last24Hours.total}</div>
                  <div className="text-sm text-muted-foreground">Total Events</div>
                  <div className="mt-4 space-y-2">
                    {Object.entries(auditStats.last24Hours.byAction).slice(0, 5).map(([action, count]) => (
                      <div key={action} className="flex justify-between">
                        <span className="text-sm">{action}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Last 7 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditStats.last7Days.total}</div>
                  <div className="text-sm text-muted-foreground">Total Events</div>
                  <div className="mt-4 space-y-2">
                    {Object.entries(auditStats.last7Days.byResource).slice(0, 5).map(([resource, count]) => (
                      <div key={resource} className="flex justify-between">
                        <span className="text-sm">{resource}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Last 30 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditStats.last30Days.total}</div>
                  <div className="text-sm text-muted-foreground">Total Events</div>
                  <div className="mt-4 space-y-2">
                    {Object.entries(auditStats.last30Days.byResource).slice(0, 5).map(([resource, count]) => (
                      <div key={resource} className="flex justify-between">
                        <span className="text-sm">{resource}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Generate Audit Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Reports contain sensitive audit data and will be logged as export operations.
                  Ensure you have appropriate permissions and business justification.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="date"
                  placeholder="Start Date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  required
                />
                <Input
                  type="date"
                  placeholder="End Date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  required
                />
                <Input
                  placeholder="User ID (optional)"
                  value={filters.userId}
                  onChange={(e) => handleFilterChange('userId', e.target.value)}
                />
                <Select value={filters.resource} onValueChange={(value) => handleFilterChange('resource', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Resource (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Resources</SelectItem>
                    <SelectItem value="cases">Cases</SelectItem>
                    <SelectItem value="documents">Documents</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="authentication">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => generateReport('json')} 
                  disabled={loading || !filters.startDate || !filters.endDate}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download JSON
                </Button>
                <Button 
                  onClick={() => generateReport('csv')} 
                  disabled={loading || !filters.startDate || !filters.endDate}
                  variant="outline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}