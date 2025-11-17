import { Router } from 'express';
import { mcLinkService } from '../../../mc_link/services/mcLinkService.js';

const router = Router();

// Public endpoints for MC account linking
router.post('/mc-link/code', mcLinkService.createCode);      // called by plugin to create code
router.post('/mc-link/verify', mcLinkService.verifyCode);    // user submits code
router.get('/mc-link/current', mcLinkService.current);       // check current linked session
router.post('/mc-link/unlink', mcLinkService.unlink);        // clear link

export default router;
