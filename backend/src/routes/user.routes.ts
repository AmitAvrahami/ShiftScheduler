import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, managerMiddleware } from '../middleware/auth.middleware';
import { User } from '../models/User';

const router = Router();

// GET /api/users — active users only (used by schedule/constraint pages)
router.get('/', authenticate, managerMiddleware, async (_req: Request, res: Response) => {
    try {
        const users = await User.find({ isActive: true, role: { $ne: 'admin' } }).select('_id name email role isFixedMorning isActive');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

// GET /api/users/all — all users including inactive (for management page)
router.get('/all', authenticate, managerMiddleware, async (_req: Request, res: Response) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
});

// POST /api/users — create new employee
router.post('/', authenticate, managerMiddleware, async (req: Request, res: Response) => {
    try {
        const { name, email, password, role = 'employee', isFixedMorning = false } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'שם, אימייל וסיסמה הם שדות חובה' });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ success: false, message: 'כתובת האימייל כבר קיימת במערכת' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, role, isFixedMorning, isActive: true });
        await user.save();

        const userResponse = user.toObject() as Record<string, any>;
        delete userResponse.password;

        return res.status(201).json({ success: true, data: userResponse });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'שגיאה ביצירת העובד' });
    }
});

// PATCH /api/users/:id — update employee
router.patch('/:id', authenticate, managerMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, email, password, role, isFixedMorning, isActive } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'עובד לא נמצא' });
        }

        if (email && email !== user.email) {
            const existing = await User.findOne({ email, _id: { $ne: id } });
            if (existing) {
                return res.status(400).json({ success: false, message: 'כתובת האימייל כבר קיימת במערכת' });
            }
        }

        if (name !== undefined) user.name = name;
        if (email !== undefined) user.email = email;
        if (role !== undefined) user.role = role;
        if (isFixedMorning !== undefined) user.isFixedMorning = isFixedMorning;
        if (isActive !== undefined) user.isActive = isActive;
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        const userResponse = user.toObject() as Record<string, any>;
        delete userResponse.password;

        return res.status(200).json({ success: true, data: userResponse });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'שגיאה בעדכון העובד' });
    }
});

// DELETE /api/users/:id — soft delete (set isActive: false)
router.delete('/:id', authenticate, managerMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'עובד לא נמצא' });
        }
        if (user.role === 'manager') {
            return res.status(403).json({ success: false, message: 'לא ניתן לבטל פעילות מנהל' });
        }

        user.isActive = false;
        await user.save();

        return res.status(200).json({ success: true, message: 'העובד בוטל בהצלחה' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'שגיאה בביטול העובד' });
    }
});

export default router;
