import express from 'express';
import { getNotifications, markAsRead, createNotification } from '../controllers/notificationController';
import { authenticate, managerMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

router.get('/', getNotifications);
router.post('/', managerMiddleware, createNotification);
router.patch('/:id/read', markAsRead);

export default router;
