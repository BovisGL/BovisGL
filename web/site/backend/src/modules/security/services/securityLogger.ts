import { Database } from 'sqlite';
import { getDatabase } from '../../auth/services/database.js';
import { verifyToken } from '../../auth/services/jwt.js';

export interface SecurityEvent {
  id?: number;
  timestamp: string;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details: string;
  metadata?: string;
}

export class SecurityLogger {
  private static instance: SecurityLogger;
  private db: Database | null = null;

  private constructor() {}

  public static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  private async ensureDatabase(): Promise<Database> {
    if (!this.db) {
      this.db = await getDatabase();
      await this.createSecurityTables();
    }
    return this.db;
  }

  private async createSecurityTables(): Promise<void> {
    const db = await this.ensureDatabase();
    
    await db.exec(`
      CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        source TEXT NOT NULL,
        user_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        details TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
      CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);

      CREATE TABLE IF NOT EXISTS security_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        metric_value TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        details TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_security_metrics_name ON security_metrics(metric_name);
      CREATE INDEX IF NOT EXISTS idx_security_metrics_timestamp ON security_metrics(timestamp);
    `);
  }

  public async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const db = await this.ensureDatabase();
      
      const timestamp = new Date().toISOString();
      
      await db.run(`
        INSERT INTO security_events (
          timestamp, event_type, severity, source, user_id, 
          ip_address, user_agent, details, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        timestamp,
        event.event_type,
        event.severity,
        event.source,
        event.user_id || null,
        event.ip_address || null,
        event.user_agent || null,
        event.details,
        event.metadata || null
      ]);

      // Also log to console for immediate visibility
      const logLevel = event.severity === 'CRITICAL' ? 'error' : 
                      event.severity === 'HIGH' ? 'warn' : 'info';
      console[logLevel](`[SECURITY] ${event.event_type}: ${event.details}`, {
        severity: event.severity,
        source: event.source,
        user_id: event.user_id,
        ip: event.ip_address
      });

      // Auto-cleanup old events (keep last 10,000 events)
      await this.cleanupOldEvents();
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  public async logMetric(metricName: string, metricValue: string, details?: string): Promise<void> {
    try {
      const db = await this.ensureDatabase();
      
      await db.run(`
        INSERT INTO security_metrics (metric_name, metric_value, details)
        VALUES (?, ?, ?)
      `, [metricName, metricValue, details || null]);
    } catch (error) {
      console.error('Failed to log security metric:', error);
    }
  }

  public async getSecurityEvents(
    limit: number = 100,
    severity?: string,
    eventType?: string,
    since?: Date
  ): Promise<SecurityEvent[]> {
    try {
      const db = await this.ensureDatabase();
      
      let query = `SELECT * FROM security_events WHERE 1=1`;
      const params: any[] = [];

      if (severity) {
        query += ` AND severity = ?`;
        params.push(severity);
      }

      if (eventType) {
        query += ` AND event_type = ?`;
        params.push(eventType);
      }

      if (since) {
        query += ` AND timestamp >= ?`;
        params.push(since.toISOString());
      }

      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      const events = await db.all(query, params);
      return events as SecurityEvent[];
    } catch (error) {
      console.error('Failed to get security events:', error);
      return [];
    }
  }

  public async getSecurityMetrics(
    metricName?: string,
    since?: Date,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const db = await this.ensureDatabase();
      
      let query = `SELECT * FROM security_metrics WHERE 1=1`;
      const params: any[] = [];

      if (metricName) {
        query += ` AND metric_name = ?`;
        params.push(metricName);
      }

      if (since) {
        query += ` AND timestamp >= ?`;
        params.push(since.toISOString());
      }

      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      return await db.all(query, params);
    } catch (error) {
      console.error('Failed to get security metrics:', error);
      return [];
    }
  }

  public async getSecuritySummary(): Promise<any> {
    try {
      const db = await this.ensureDatabase();
      
      const summary = await db.all(`
        SELECT 
          severity,
          COUNT(*) as count,
          MIN(timestamp) as earliest,
          MAX(timestamp) as latest
        FROM security_events 
        WHERE timestamp >= datetime('now', '-24 hours')
        GROUP BY severity
        ORDER BY 
          CASE severity 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'HIGH' THEN 2 
            WHEN 'MEDIUM' THEN 3 
            WHEN 'LOW' THEN 4 
          END
      `);

      const recentEvents = await db.all(`
        SELECT event_type, COUNT(*) as count
        FROM security_events 
        WHERE timestamp >= datetime('now', '-1 hour')
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 10
      `);

      return {
        summary,
        recentEvents,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get security summary:', error);
      return { summary: [], recentEvents: [], lastUpdated: new Date().toISOString() };
    }
  }

  private async cleanupOldEvents(): Promise<void> {
    try {
      const db = await this.ensureDatabase();
      
      // Keep only the most recent 10,000 security events
      await db.run(`
        DELETE FROM security_events 
        WHERE id NOT IN (
          SELECT id FROM security_events 
          ORDER BY timestamp DESC 
          LIMIT 10000
        )
      `);

      // Clean up metrics older than 30 days
      await db.run(`
        DELETE FROM security_metrics 
        WHERE timestamp < datetime('now', '-30 days')
      `);
    } catch (error) {
      console.error('Failed to cleanup old events:', error);
    }
  }
}

// Convenience functions for common security events
export const securityLogger = SecurityLogger.getInstance();

export const logAuthenticationAttempt = (success: boolean, userId?: string, ip?: string, userAgent?: string, details?: string) => {
  securityLogger.logSecurityEvent({
    event_type: success ? 'AUTH_SUCCESS' : 'AUTH_FAILURE',
    severity: success ? 'LOW' : 'MEDIUM',
    source: 'authentication',
    user_id: userId,
    ip_address: ip,
    user_agent: userAgent,
    details: details || (success ? 'Successful authentication' : 'Failed authentication attempt')
  });
};

export const logPasskeyEvent = (event: string, userId?: string, ip?: string, details?: string) => {
  securityLogger.logSecurityEvent({
    event_type: `PASSKEY_${event.toUpperCase()}`,
    severity: 'LOW',
    source: 'passkey',
    user_id: userId,
    ip_address: ip,
    details: details || `Passkey ${event}`
  });
};

export const logSecurityViolation = (violationType: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', details: string, ip?: string, userAgent?: string) => {
  securityLogger.logSecurityEvent({
    event_type: `SECURITY_VIOLATION_${violationType.toUpperCase()}`,
    severity,
    source: 'security_monitor',
    ip_address: ip,
    user_agent: userAgent,
    details
  });
};

export const logSystemEvent = (event: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', details: string, userId?: string) => {
  securityLogger.logSecurityEvent({
    event_type: `SYSTEM_${event.toUpperCase()}`,
    severity,
    source: 'system',
    user_id: userId,
    details
  });
};

export const logTamperDetection = (tamperType: string, ip?: string, userAgent?: string, details?: string) => {
  securityLogger.logSecurityEvent({
    event_type: `TAMPER_${tamperType.toUpperCase()}`,
    severity: 'HIGH',
    source: 'tamper_detection',
    ip_address: ip,
    user_agent: userAgent,
    details: details || `Tamper detection: ${tamperType}`
  });
}; 