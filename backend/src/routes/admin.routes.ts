import { Router } from 'express';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';
import { getDashboard } from '../controllers/adminController';

const router = Router();

router.get('/dashboard', verifyToken, isAdmin, getDashboard);

export default router;
