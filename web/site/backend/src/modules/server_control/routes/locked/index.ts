import { Router } from 'express';
import { serverControlService } from '../../services/serverServices.js';

const router = Router();

// Protected server control routes (require admin authentication)
router.get('/servers', serverControlService.getServerStatus);
router.get('/servers/:id/status', serverControlService.getServerStatus);
router.post('/servers/:id/start', serverControlService.startServer);
router.post('/servers/:id/stop', serverControlService.stopServer);
router.post('/servers/:id/restart', serverControlService.restartServer);
router.post('/servers/:id/kill', serverControlService.killServer);
router.post('/servers/:id/force-stop', serverControlService.forceStopServer);

// RCON command endpoint
router.post('/servers/:id/command', serverControlService.sendCommand);

// Log viewing endpoints
router.get('/servers/:id/logs', serverControlService.getLogs);

// Removed crash/early-warning/statistics routes (feature disabled)

// Player management routes
router.get('/players/:uuid/details', serverControlService.getPlayerDetails);

export default router;