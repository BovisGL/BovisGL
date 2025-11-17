import crypto from 'crypto';
import { Request, Response } from 'express';

interface PendingLink {
  code: string;
  serverId: string;
  username: string; // Minecraft username provided by plugin
  createdAt: number;
}

// In-memory store (ephemeral) – cleared on restart
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const pendingLinks: Map<string, PendingLink> = new Map(); // code -> PendingLink

function generateCode(): string {
  // 6-char alphanumeric (letters + numbers without easily confused chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = crypto.randomInt(0, chars.length);
    code += chars[idx];
  }
  return code;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [code, entry] of pendingLinks.entries()) {
    if (now - entry.createdAt > CODE_TTL_MS) {
      pendingLinks.delete(code);
    }
  }
}

export const mcLinkService = {
  // Called by plugin via proxy backend (public for now – can add shared secret later)
  createCode: (req: Request, res: Response) => {
    try {
      const { username, serverId } = req.body || {};
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'username required' });
      }
      const code = generateCode();
      pendingLinks.set(code, { code, serverId: serverId || 'unknown', username, createdAt: Date.now() });
      cleanupExpired();
      return res.json({ success: true, code, expiresInSeconds: CODE_TTL_MS / 1000 });
    } catch (e) {
      console.error('Failed to create link code', e);
      return res.status(500).json({ error: 'internal error' });
    }
  },

  // User submits code at /connect page
  verifyCode: (req: Request, res: Response) => {
    try {
      const { code } = req.body || {};
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'code required' });
      }
      cleanupExpired();
      const upper = code.toUpperCase().trim();
      const entry = pendingLinks.get(upper);
      if (!entry) {
        return res.status(404).json({ error: 'invalid or expired code' });
      }

      // Basic session cookie (non-persistent after leaving site) – 30 min expiry
      const session = {
        mcUser: entry.username,
        linkedAt: Date.now(),
      };
      // Store lightweight token in cookie (unsigned JSON base64 for simplicity – NOT for secure auth)
      const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
      res.cookie('mc_link', payload, {
        httpOnly: false, // frontend can read to show name
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 60 * 1000,
        path: '/',
      });

      pendingLinks.delete(upper);
      return res.json({ success: true, username: entry.username });
    } catch (e) {
      console.error('Failed to verify link code', e);
      return res.status(500).json({ error: 'internal error' });
    }
  },

  current: (req: Request, res: Response) => {
    try {
      const raw = (req as any).cookies?.mc_link;
      if (!raw) return res.json({ linked: false });
      try {
        const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString());
        return res.json({ linked: true, username: decoded.mcUser });
      } catch {
        return res.json({ linked: false });
      }
    } catch (e) {
      console.error('Failed to read current link', e);
      return res.status(500).json({ error: 'internal error' });
    }
  },

  unlink: (_req: Request, res: Response) => {
    res.clearCookie('mc_link', { path: '/' });
    res.json({ success: true });
  }
};
