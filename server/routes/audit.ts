import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { auditMiddleware, logExportOperation, logError } from '../middleware/audit';
import { storage } from '../storage';
import { z } from 'zod';

const router = express.Router();

// Apply authentication and audit middleware to all routes
router.use(authenticate);
router.use(auditMiddleware);

// Audit log query schema
const auditQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']).optional()
});

// Audit report query schema
const auditReportSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  userId: z.string().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  format: z.enum(['json', 'csv']).optional().default('json')
});

/**
 * GET /api/audit
 * Get paginated audit logs with filtering
 * Requires admin role
 */
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const filters = auditQuerySchema.parse(req.query);
    
    // Convert date strings to Date objects
    const processedFilters = {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined
    };
    
    const result = await storage.getAuditLog(processedFilters);
    
    res.json({
      ...result,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: result.total > (filters.offset + filters.limit)
      }
    });
  } catch (error) {
    logError(req, error as Error, { endpoint: 'GET /api/audit' });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /api/audit/report
 * Generate comprehensive audit report
 * Requires admin role
 */
router.get('/report', authorize('admin'), async (req, res) => {
  try {
    const params = auditReportSchema.parse(req.query);
    
    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    
    // Validate date range
    if (startDate >= endDate) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }
    
    // Limit report to reasonable time ranges
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return res.status(400).json({ error: 'Report period cannot exceed 365 days' });
    }
    
    const report = await storage.getAuditReport(startDate, endDate, {
      userId: params.userId,
      resource: params.resource,
      action: params.action
    });
    
    // Log the export operation
    logExportOperation(
      req,
      'audit-report',
      report.entries.map(e => e.id),
      params.format,
      true // Contains PII
    );
    
    if (params.format === 'csv') {
      // Generate CSV format
      const csvData = generateAuditCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-report-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } else {
      // Return JSON with enhanced metadata
      res.json({
        ...report,
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: req.user?.id,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            days: daysDiff
          },
          filters: {
            userId: params.userId,
            resource: params.resource,
            action: params.action
          }
        }
      });
    }
  } catch (error) {
    logError(req, error as Error, { endpoint: 'GET /api/audit/report' });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to generate audit report' });
  }
});

/**
 * GET /api/audit/user/:userId
 * Get audit logs for specific user
 * Requires admin role or own user data
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    
    // Allow users to view their own audit logs, admin can view any
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      return res.status(403).json({ error: 'Cannot view other users audit logs' });
    }
    
    const entries = await storage.getAuditLogsByUser(userId, limit);
    
    res.json({ entries, total: entries.length });
  } catch (error) {
    logError(req, error as Error, { endpoint: 'GET /api/audit/user/:userId' });
    res.status(500).json({ error: 'Failed to fetch user audit logs' });
  }
});

/**
 * GET /api/audit/resource/:resource
 * Get audit logs for specific resource
 * Requires admin role
 */
router.get('/resource/:resource', authorize('admin'), async (req, res) => {
  try {
    const { resource } = req.params;
    const { resourceId } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    
    const entries = await storage.getAuditLogsByResource(
      resource,
      resourceId as string,
      limit
    );
    
    res.json({ entries, total: entries.length });
  } catch (error) {
    logError(req, error as Error, { endpoint: 'GET /api/audit/resource/:resource' });
    res.status(500).json({ error: 'Failed to fetch resource audit logs' });
  }
});

/**
 * DELETE /api/audit/cleanup
 * Clean up old audit logs based on retention policy
 * Requires admin role and confirmation
 */
router.delete('/cleanup', authorize('admin'), async (req, res) => {
  try {
    const retentionDays = parseInt(req.query.retentionDays as string) || (7 * 365); // 7 years default
    const confirm = req.query.confirm === 'true';
    
    if (!confirm) {
      return res.status(400).json({ 
        error: 'Confirmation required',
        message: 'Add ?confirm=true to proceed with cleanup'
      });
    }
    
    if (retentionDays < 30) {
      return res.status(400).json({ error: 'Retention period cannot be less than 30 days' });
    }
    
    const result = await storage.cleanupOldAuditLogs(retentionDays);
    
    // Log this critical operation
    req.user && logExportOperation(
      req,
      'audit-cleanup',
      [],
      'deletion',
      true // This is a sensitive operation
    );
    
    res.json({
      message: 'Audit log cleanup completed',
      deleted: result.deleted,
      retentionDays
    });
  } catch (error) {
    logError(req, error as Error, { endpoint: 'DELETE /api/audit/cleanup' });
    res.status(500).json({ error: 'Failed to cleanup audit logs' });
  }
});

/**
 * GET /api/audit/stats
 * Get audit statistics and health metrics
 * Requires admin role
 */
router.get('/stats', authorize('admin'), async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get statistics for different time periods
    const [last24HoursStats, last7DaysStats, last30DaysStats] = await Promise.all([
      storage.getAuditReport(last24Hours, now),
      storage.getAuditReport(last7Days, now),
      storage.getAuditReport(last30Days, now)
    ]);
    
    res.json({
      last24Hours: {
        total: last24HoursStats.summary.total,
        byAction: last24HoursStats.summary.byAction,
        byResource: last24HoursStats.summary.byResource
      },
      last7Days: {
        total: last7DaysStats.summary.total,
        byAction: last7DaysStats.summary.byAction,
        byResource: last7DaysStats.summary.byResource
      },
      last30Days: {
        total: last30DaysStats.summary.total,
        byAction: last30DaysStats.summary.byAction,
        byResource: last30DaysStats.summary.byResource
      },
      generatedAt: now.toISOString()
    });
  } catch (error) {
    logError(req, error as Error, { endpoint: 'GET /api/audit/stats' });
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

// Helper function to generate CSV from audit report
function generateAuditCSV(report: any): string {
  const headers = [
    'Timestamp',
    'User ID',
    'Action',
    'Resource',
    'Resource ID',
    'Result',
    'IP Address',
    'User Agent',
    'Details'
  ];
  
  const csvLines = [headers.join(',')];
  
  report.entries.forEach((entry: any) => {
    const metadata = entry.metadata || {};
    const row = [
      entry.timestamp,
      entry.userId,
      entry.action,
      entry.resource,
      entry.resourceId,
      metadata.result || 'UNKNOWN',
      metadata.ipAddress || '',
      metadata.userAgent || '',
      JSON.stringify(metadata.details || {}).replace(/"/g, '""') // Escape quotes for CSV
    ];
    
    csvLines.push(row.map(field => `"${field}"`).join(','));
  });
  
  return csvLines.join('\n');
}

export default router;