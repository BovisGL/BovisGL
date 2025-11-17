import { Router, Request, Response } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { systemShutdownService } from '../services/systemShutdownService.js';
import { forceSignoutService } from '../../security/services/forceSignoutService.js';
import { logSystemEvent, SecurityLogger } from '../../security/services/securityLogger.js';
import { verifyToken } from '../../auth/services/jwt.js';

// Get SecurityLogger instance
const securityLogger = SecurityLogger.getInstance();

const router = Router();

// CSRF protection for all system routes
const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'your-strong-secret-key',
  getSessionIdentifier: (req) => req.sessionID || 'default-session',
  cookieName: process.env.NODE_ENV === 'production' ? '__Host-psifi.x-csrf-token' : 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    path: '/'
  }
});

const csrfProtection = doubleCsrfProtection;

// Enhanced authentication middleware that extracts user info
const authenticateSystemAdmin = (req: any, res: Response, next: any) => {
  try {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required for system operations' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.adminUser = {
      id: decoded.id || decoded.adminId,
      username: decoded.username,
      name: decoded.name
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication verification failed' });
  }
};

// Get system status (no CSRF needed for read operations)
router.get('/status', authenticateSystemAdmin, async (req: any, res: Response) => {
  try {
    const status = await systemShutdownService.getSystemStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to get system status: ${error.message}` });
  }
});

// Get security events and logs
router.get('/security/events', authenticateSystemAdmin, async (req: any, res: Response) => {
  try {
    const { limit = 100, severity, eventType, since } = req.query;
    
    const sinceDate = since ? new Date(since as string) : undefined;
    const events = await securityLogger.getSecurityEvents(
      parseInt(limit as string),
      severity as string,
      eventType as string,
      sinceDate
    );

    res.json({ events, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to get security events: ${error.message}` });
  }
});

// Get security summary
router.get('/security/summary', authenticateSystemAdmin, async (req: any, res: Response) => {
  try {
    const summary = await securityLogger.getSecuritySummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to get security summary: ${error.message}` });
  }
});

// Get authentication statistics
router.get('/auth/stats', authenticateSystemAdmin, async (req: any, res: Response) => {
  try {
    const stats = await forceSignoutService.getAuthenticationStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to get authentication stats: ${error.message}` });
  }
});

// CRITICAL: Complete system shutdown
router.post('/shutdown/complete', csrfProtection, authenticateSystemAdmin, async (req: any, res: Response) => {
  try {
    const { confirmation } = req.body;
    
    // Require explicit confirmation
    if (confirmation !== 'I understand this will shutdown all BovisGL services and can only be restarted from the host machine') {
      return res.status(400).json({ 
        error: 'Invalid confirmation message',
        requiredConfirmation: 'I understand this will shutdown all BovisGL services and can only be restarted from the host machine'
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Log the shutdown attempt
    await securityLogger.logSecurityEvent({
      event_type: 'SYSTEM_SHUTDOWN_REQUESTED',
      severity: 'CRITICAL',
      source: 'admin_panel',
      user_id: req.adminUser.id,
      ip_address: clientIp,
      details: `Complete system shutdown requested by ${req.adminUser.displayName} (${req.adminUser.username})`
    });

    const result = await systemShutdownService.executeCompleteShutdown(
      req.adminUser.id,
      req.adminUser.displayName
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: `Shutdown failed: ${error.message}` });
  }
});

// CRITICAL: Force signout all users
router.post('/auth/force-signout', csrfProtection, authenticateSystemAdmin, async (req: any, res: Response) => {
  try {
    const { confirmation, createNewAdminInvite, adminDisplayName } = req.body;
    
    // Require explicit confirmation
    if (confirmation !== 'I understand this will remove all passkeys and invalidate all JWT tokens') {
      return res.status(400).json({ 
        error: 'Invalid confirmation message',
        requiredConfirmation: 'I understand this will remove all passkeys and invalidate all JWT tokens'
      });
    }

    // If creating new admin invite, require display name
    if (createNewAdminInvite && !adminDisplayName) {
      return res.status(400).json({ 
        error: 'Admin display name required when creating new admin invite'
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Log the force signout attempt
    await securityLogger.logSecurityEvent({
      event_type: 'FORCE_SIGNOUT_REQUESTED',
      severity: 'CRITICAL',
      source: 'admin_panel',
      user_id: req.adminUser.id,
      ip_address: clientIp,
      details: `Force signout requested by ${req.adminUser.displayName}. Create new invite: ${createNewAdminInvite}`
    });

    const result = await forceSignoutService.executeForceSignout(
      req.adminUser.id,
      req.adminUser.displayName,
      {
        createNewAdminInvite: createNewAdminInvite || false,
        adminDisplayName: adminDisplayName || undefined
      }
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: `Force signout failed: ${error.message}` });
  }
});

// Log security event manually (for testing/debugging)
router.post('/security/log-event', csrfProtection, authenticateSystemAdmin, async (req: any, res: Response) => {
  try {
    const { eventType, severity, details, metadata } = req.body;
    
    if (!eventType || !severity || !details) {
      return res.status(400).json({ 
        error: 'eventType, severity, and details are required'
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    await securityLogger.logSecurityEvent({
      event_type: `MANUAL_${eventType.toUpperCase()}`,
      severity: severity.toUpperCase(),
      source: 'admin_panel',
      user_id: req.adminUser.id,
      ip_address: clientIp,
      details,
      metadata: metadata ? JSON.stringify(metadata) : undefined
    });

    res.json({ 
      success: true, 
      message: 'Security event logged successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to log security event: ${error.message}` });
  }
});

export default router; 