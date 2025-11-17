import { Router } from 'express';
import { serverControlService } from '../../services/serverServices.js';

const router = Router();

// Public server routes (no auth required)
router.get('/servers/status', serverControlService.getAllServersStatus);
router.get('/servers/online-players', serverControlService.getOnlinePlayers);

export default router; 