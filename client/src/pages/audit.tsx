import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AuditLog } from "@shared/schema";

export default function Audit() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [showPII, setShowPII] = useState(false);
  const [dateRange, setDateRange] = useState("7days");

  // Mock audit data - in production this would come from the API
  const mockAuditLogs: AuditLog[] = [
    {
      id: "audit1",
      userId: "user1",
      action: "case_created",
      resource: "case",
      resourceId: "case1",
      metadata: { title: "Employment Tribunal Case", clientRef: "EMP-2024-001" },
      redactedData: "[CLIENT_NAME] vs [COMPANY_NAME] employment dispute",
      timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
    },
    {
      id: "audit2", 
      userId: "user1",
      action: "document_uploaded",
      resource: "document",
      resourceId: "doc1",
      metadata: { fileName: "[REDACTED].pdf", caseId: "case1" },
      redactedData: "Document upload for case [CASE_REF]",
      timestamp: new Date(Date.now() - 900000), // 15 minutes ago
    },
    {
      id: "audit3",
      userId: "user1", 
      action: "search_executed",
      resource: "search",
      resourceId: "search1",
      metadata: { query: "termination clauses", results: 3 },
      redactedData: "User searched for termination-related content",
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
    },
  ];

  const getActionIcon = (action: string) => {
    switch (action) {
      case "case_created": return "fas fa-plus-circle text-secondary";
      case "case_updated": return "fas fa-edit text-primary";
      case "case_deleted": return "fas fa-trash text-destructive";
      case "document_uploaded": return "fas fa-upload text-accent";
      case "document_viewed": return "fas fa-eye text-muted-foreground";
      case "search_executed": return "fas fa-search text-primary";
      case "draft_generated": return "fas fa-robot text-secondary";
      case "ai_processing": return "fas fa-brain text-primary";
      case "consent_granted": return "fas fa-check-circle text-secondary";
      case "consent_revoked": return "fas fa-times-circle text-destructive";
      default: return "fas fa-info-circle text-muted-foreground";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "case_created": return "Case Created";
      case "case_updated": return "Case Updated";
      case "case_deleted": return "Case Deleted";
      case "document_uploaded": return "Document Uploaded";
      case "document_viewed": return "Document Viewed";
      case "search_executed": return "Search Executed";
      case "draft_generated": return "Draft Generated";
      case "ai_processing": return "AI Processing";
      case "consent_granted": return "Consent Granted";
      case "consent_revoked": return "Consent Revoked";
      default: return action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes("delete") || action.includes("revoke")) return "bg-destructive/10 text-destructive";
    if (action.includes("create") || action.includes("grant")) return "bg-secondary/10 text-secondary";
    if (action.includes("update") || action.includes("edit")) return "bg-primary/10 text-primary";
    return "bg-muted/10 text-muted-foreground";
  };

  const filteredLogs = mockAuditLogs.filter(log => {
    if (searchTerm && !log.redactedData.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (actionFilter !== "all" && log.action !== actionFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Audit Log" 
          subtitle="Privacy-focused audit trail with automatic PII redaction"
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Filters and Controls */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search audit logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="search-audit-logs"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Select value={actionFilter} onValueChange={setActionFilter} data-testid="filter-action">
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="case_created">Case Created</SelectItem>
                        <SelectItem value="document_uploaded">Document Upload</SelectItem>
                        <SelectItem value="search_executed">Search</SelectItem>
                        <SelectItem value="draft_generated">Draft Generated</SelectItem>
                        <SelectItem value="ai_processing">AI Processing</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={dateRange} onValueChange={setDateRange} data-testid="filter-date-range">
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1day">Last 24 hours</SelectItem>
                        <SelectItem value="7days">Last 7 days</SelectItem>
                        <SelectItem value="30days">Last 30 days</SelectItem>
                        <SelectItem value="90days">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-pii"
                      checked={showPII}
                      onCheckedChange={setShowPII}
                      data-testid="toggle-pii"
                    />
                    <Label htmlFor="show-pii" className="text-sm font-medium">
                      Show Potentially Sensitive Data
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" data-testid="export-audit-logs">
                      <i className="fas fa-download mr-2"></i>
                      Export Logs
                    </Button>
                    <Button variant="outline" size="sm" data-testid="refresh-audit-logs">
                      <i className="fas fa-sync-alt mr-2"></i>
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit Logs */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Audit Trail</CardTitle>
                    <CardDescription>
                      Showing {filteredLogs.length} of {mockAuditLogs.length} audit entries
                    </CardDescription>
                  </div>
                  <Badge variant="outline" data-testid="audit-logs-count">
                    {filteredLogs.length} entries
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center text-muted-foreground p-8" data-testid="no-audit-logs">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-clipboard-list text-2xl"></i>
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">No audit logs found</h3>
                      <p className="text-sm">
                        No audit entries match your current filters. Try adjusting the search criteria.
                      </p>
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div key={log.id} className="border border-border rounded-lg p-4" data-testid={`audit-log-${log.id}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                              <i className={getActionIcon(log.action)}></i>
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground" data-testid={`audit-action-${log.id}`}>
                                {getActionLabel(log.action)}
                              </h3>
                              <p className="text-sm text-muted-foreground" data-testid={`audit-timestamp-${log.id}`}>
                                {format(log.timestamp, "dd MMM yyyy, HH:mm:ss")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getActionColor(log.action)} data-testid={`audit-action-badge-${log.id}`}>
                              {log.action}
                            </Badge>
                            <Badge variant="outline" data-testid={`audit-resource-${log.id}`}>
                              {log.resource}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Description: </span>
                            <span className="text-foreground" data-testid={`audit-description-${log.id}`}>
                              {showPII ? `[RAW DATA WOULD SHOW HERE]` : log.redactedData}
                            </span>
                          </div>
                          
                          {log.metadata && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Details: </span>
                              <span className="text-foreground" data-testid={`audit-metadata-${log.id}`}>
                                {Object.entries(log.metadata).map(([key, value]) => (
                                  `${key}: ${showPII ? value : '[REDACTED]'}`
                                )).join(", ")}
                              </span>
                            </div>
                          )}
                          
                          <div className="text-sm">
                            <span className="text-muted-foreground">Resource ID: </span>
                            <span className="text-foreground font-mono" data-testid={`audit-resource-id-${log.id}`}>
                              {log.resourceId}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Privacy Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Compliance</CardTitle>
                <CardDescription>Automatic data protection and audit controls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-user-shield text-secondary"></i>
                      <h4 className="font-medium text-foreground">PII Redaction</h4>
                    </div>
                    <p className="text-muted-foreground">
                      Personal information is automatically detected and redacted from audit logs and search indexes.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-clock text-primary"></i>
                      <h4 className="font-medium text-foreground">Retention Policy</h4>
                    </div>
                    <p className="text-muted-foreground">
                      Audit logs are retained for 7 years as required by UK legal practice regulations.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-download text-accent"></i>
                      <h4 className="font-medium text-foreground">Export Compliance</h4>
                    </div>
                    <p className="text-muted-foreground">
                      Generate compliance reports and export audit trails for regulatory requirements.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warning about PII */}
            {showPII && (
              <Card className="border-destructive bg-destructive/5">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <i className="fas fa-exclamation-triangle text-destructive"></i>
                    <div>
                      <h4 className="font-medium text-destructive">Sensitive Data Mode Enabled</h4>
                      <p className="text-sm text-destructive/80">
                        You have enabled the display of potentially sensitive information. 
                        This should only be used for authorized compliance reviews.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
