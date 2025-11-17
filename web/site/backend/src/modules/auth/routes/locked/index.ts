import { Router } from 'express';
import { authService } from '../../services/authServices.js';

const router = Router();

// Protected authentication routes (require auth)
router.get('/auth/verify', authService.verifyAuth);

// Legacy route for cached frontend compatibility
router.post('/auth/create-admin-invite', authService.createAdminInvite);

// Admin device management
router.get('/admin/devices', authService.getAdminDevices);
router.post('/admin/check', authService.checkAdmin);
router.post('/admin/create', authService.createAdmin);
router.post('/admin/create-invite', authService.createAdminInvite);
router.post('/admin/remove-current-device', authService.removeCurrentDevice);

// Session management available through system admin routes

// Admin logs
router.get('/admin/logs', authService.getAdminLogs);
router.get('/admin/logs/formatted', authService.getFormattedAdminLogs);

// Link currently linked MC session (from mc_link cookie) to this admin account
router.post('/admin/link-minecraft', async (req: any, res) => {
	try {
		if (!req.user?.name) return res.status(401).json({ error: 'Not authenticated' });
		const cookie = req.cookies?.mc_link;
		if (!cookie) return res.status(400).json({ error: 'No MC link session found' });
		let username: string | undefined;
		try {
			const decoded = JSON.parse(Buffer.from(cookie, 'base64url').toString());
			username = decoded.mcUser;
		} catch {
			return res.status(400).json({ error: 'Invalid MC link cookie' });
		}
		if (!username) return res.status(400).json({ error: 'Missing username in session' });
		const { adminOps } = await import('../../services/database.js');
		const updated = await adminOps.setMinecraftUsername(req.user.name, username);
		res.json({ success: true, mc_username: updated.mc_username });
	} catch (e) {
		console.error('Failed to link minecraft account:', e);
		res.status(500).json({ error: 'Failed to link minecraft account' });
	}
});

export default router; 