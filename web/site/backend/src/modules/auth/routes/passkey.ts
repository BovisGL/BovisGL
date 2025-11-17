import { Router, Request, Response } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { passkeyService } from '../services/passkey.js';
import { initDatabase } from '../services/database.js';
import crypto from 'crypto';

const router = Router();

// CSRF protection middleware for state-changing operations
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

// Initialize database on startup
initDatabase().catch(console.error);

// Helper to generate session ID
function generateSessionId(req: Request): string {
  const sessionId = req.sessionID || crypto.randomUUID();
  return sessionId;
}

// Get registration options for invite-based registration
router.get('/invite-registration-options', async (req: Request, res: Response) => {
  try {
    const { inviteToken } = req.query;
    
    if (!inviteToken || typeof inviteToken !== 'string') {
      return res.status(400).json({ error: 'Invalid invite token' });
    }

    const sessionId = generateSessionId(req);
    const { options, admin } = await passkeyService.getInviteRegistrationOptions(inviteToken, sessionId);

    // Store session info
    (req.session as any).currentChallenge = options.challenge;
    (req.session as any).sessionId = sessionId;
    (req.session as any).adminId = admin.id;
    (req.session as any).inviteToken = inviteToken; // SECURITY: Store for verification

    res.json({ options, admin });
  } catch (error: any) {
    console.error('Error generating invite registration options:', error);
    res.status(400).json({ error: error.message });
  }
});

// Verify invite-based registration
router.post('/invite-registration-verify', csrfProtection, async (req: Request, res: Response) => {
  try {
    const { attestation, credential, deviceName, inviteToken } = req.body;
    const sessionId = (req.session as any).sessionId;
    const storedInviteToken = (req.session as any).inviteToken;

    if (!sessionId) {
      return res.status(400).json({ error: 'No registration session found' });
    }

    // SECURITY: Invite token is REQUIRED - refuse if not provided
    if (!inviteToken) {
      return res.status(400).json({ error: 'Invite token is required for registration' });
    }

    // SECURITY: Validate token matches session
    if (!storedInviteToken || inviteToken !== storedInviteToken) {
      return res.status(400).json({ error: 'Token validation failed' });
    }

    // Support both 'attestation' (from frontend) and 'credential' (legacy)
    const registrationResponse = attestation || credential;
    
    if (!registrationResponse) {
      return res.status(400).json({ error: 'Missing registration response' });
    }

    // Get client IP for logging
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    // SECURITY: Re-validate token and check expiry again before registration
    const result = await passkeyService.verifyRegistration(sessionId, registrationResponse, deviceName, clientIp, inviteToken);

    if (result.success) {
      // Set JWT token as HTTP-only cookie
      res.cookie('auth_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      // Clear session data
      delete (req.session as any).currentChallenge;
      delete (req.session as any).sessionId;
      delete (req.session as any).adminId;
      delete (req.session as any).inviteToken;

      res.json({
        success: true,
        token: result.token,
        expiryTime: result.expiryTime,
        admin: {
          id: result.admin.id,
          name: result.admin.name,
        }
      });
    } else {
      res.status(400).json({ error: 'Registration verification failed' });
    }
  } catch (error: any) {
    console.error('Error verifying registration:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get authentication options for login (no CSRF protection needed for login initiation)
router.post('/login/options', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    
    // Debug logging
    console.log('[DEBUG] Backend received login options request:');
    console.log('  req.body:', req.body);
    console.log('  name:', name);

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const sessionId = generateSessionId(req);
    const options = await passkeyService.getAuthenticationOptions(name, sessionId);

    // Store session info
    (req.session as any).currentChallenge = options.challenge;
    (req.session as any).sessionId = sessionId;
    (req.session as any).loginName = name;

    res.json(options);
  } catch (error: any) {
    console.error('Error generating authentication options:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get cross-platform authentication options (no CSRF protection needed for login initiation)
router.post('/login/cross-platform-options', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const sessionId = generateSessionId(req);
    const options = await passkeyService.getCrossPlatformAuthenticationOptions(name, sessionId);

    // Store session info
    (req.session as any).currentChallenge = options.challenge;
    (req.session as any).sessionId = sessionId;
    (req.session as any).loginName = name;

    res.json(options);
  } catch (error: any) {
    console.error('Error generating cross-platform authentication options:', error);
    res.status(400).json({ error: error.message });
  }
});

// Verify authentication (no CSRF protection needed for login verification)
router.post('/login/verify', async (req: Request, res: Response) => {
  try {
    const { assertion } = req.body;
    const sessionId = (req.session as any).sessionId;

    if (!sessionId) {
      return res.status(400).json({ error: 'No authentication session found' });
    }

    // Get client IP for logging
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    const result = await passkeyService.verifyAuthentication(sessionId, assertion, clientIp);

    if (result.success) {
      // Set JWT token as HTTP-only cookie
      res.cookie('auth_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      // Clear session data
      delete (req.session as any).currentChallenge;
      delete (req.session as any).sessionId;
      delete (req.session as any).loginDisplayName;

      res.json({
        success: true,
        token: result.token,
        expiryTime: result.expiryTime,
        admin: {
          id: result.admin.id,
          name: result.admin.name,
        }
      });
    } else {
      res.status(400).json({ error: 'Authentication verification failed' });
    }
  } catch (error: any) {
    console.error('Error verifying authentication:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available admins with passkeys (for simplified login)
router.get('/available-admins', async (req: Request, res: Response) => {
  try {
    const admins = await passkeyService.getAvailableAdmins();
    res.json({
      success: true,
      admins: admins.map((admin: any) => ({
        id: admin.id,
        name: admin.name,
        display_name: admin.name // Use name as display_name for compatibility
      }))
    });
  } catch (error: any) {
    console.error('Error getting available admins:', error);
    res.status(500).json({ error: error.message });
  }
});

// Force signout available through system admin routes only

export default router; 