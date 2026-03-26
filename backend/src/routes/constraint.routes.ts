import express from 'express';
import {
    submitConstraints,
    getMyConstraints,
    getWeekConstraints,
    lockConstraints,
    unlockConstraints,
    copyWeekConstraints,
    overrideConstraintByManager,
} from '../controllers/constraintController';
import { authenticate, managerMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// All constraint routes require authentication
router.use(authenticate);

// Employee routes
router.post('/', submitConstraints);
router.get('/my/:weekId', getMyConstraints);

// Manager routes
router.get('/week/:weekId', managerMiddleware, getWeekConstraints);
router.patch('/lock/:weekId', managerMiddleware, lockConstraints);
router.patch('/unlock/:weekId', managerMiddleware, unlockConstraints);
router.post('/copy-week', managerMiddleware, copyWeekConstraints);
router.patch('/override/:userId/:weekId', managerMiddleware, overrideConstraintByManager);

export default router;
