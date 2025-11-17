import { Router } from 'express';
import lockedRoutesRouter from './locked/index.js';

// Public routes for data module
export const publicRoutes = Router();

// Export locked routes with the correct name expected by index.ts
export const lockedRoutes = lockedRoutesRouter; 