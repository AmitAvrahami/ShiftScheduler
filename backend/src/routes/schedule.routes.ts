import express from 'express';
import { generateSchedule, getSchedule, publishSchedule, getMySchedule, updateShifts } from '../controllers/scheduleController';
import { authenticate, managerMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// All schedule routes require authentication
router.use(authenticate);

// GET /:weekId/my — must come BEFORE /:weekId to avoid param collision
router.get('/:weekId/my', getMySchedule);

// Manager-only routes
router.post('/generate', managerMiddleware, generateSchedule);
router.patch('/:weekId/publish', managerMiddleware, publishSchedule);
router.patch('/:weekId/shifts', managerMiddleware, updateShifts);

// All-authenticated routes
router.get('/:weekId', getSchedule);

export default router;
