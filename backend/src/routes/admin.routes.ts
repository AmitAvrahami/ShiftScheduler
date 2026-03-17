import express from 'express';
import {
    getStats,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    getAllConstraints,
    overrideConstraint,
    getAllSchedules,
    forceDeleteSchedule,
} from '../controllers/adminController';
import { authenticate, adminMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// All admin routes require authentication AND admin role
router.use(authenticate);
router.use(adminMiddleware);

// Stats
router.get('/stats', getStats);

// Users
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Constraints
router.get('/constraints', getAllConstraints);
router.patch('/constraints/:userId/:weekId', overrideConstraint);

// Schedules
router.get('/schedules', getAllSchedules);
router.delete('/schedules/:weekId', forceDeleteSchedule);

export default router;
