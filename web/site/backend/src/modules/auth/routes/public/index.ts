import { Router } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { authService } from '../../services/authServices.js';

const router = Router();

// CSRF protection middleware for specific routes
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

// Public authentication routes (no auth required)
router.get('/csrf-token', csrfProtection, authService.getCsrfToken);
router.post('/auth/login', csrfProtection, authService.login);
router.post('/auth/logout', csrfProtection, authService.logout);

export default router; 