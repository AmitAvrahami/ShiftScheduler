import { Router, Request, Response } from 'express';
import { authenticate, managerMiddleware } from '../middleware/auth.middleware';
import { User } from '../models/User';

const router = Router();

router.get('/', authenticate, managerMiddleware, async (_req: Request, res: Response) => {
    try {
        const users = await User.find({ isActive: true }).select('_id name email role');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

export default router;
