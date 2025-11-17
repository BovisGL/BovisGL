import { Router } from 'express';
import { consoleService } from '../../services/consoleServices.js';

const router = Router();

// All console routes require authentication
router.get('/servers/:id/logs', consoleService.getServerLogs);
router.post('/servers/:id/command', consoleService.sendRconCommand);
router.get('/logs/statistics', consoleService.getLogStatistics);
router.post('/logs/cleanup', consoleService.cleanupLogs);

export default router; 