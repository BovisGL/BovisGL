import { Router } from 'express';
import { authService } from '../services/authServices.js';
import publicRoutes from './public/index.js';
import lockedRoutes from './locked/index.js';

export { publicRoutes, lockedRoutes }; 