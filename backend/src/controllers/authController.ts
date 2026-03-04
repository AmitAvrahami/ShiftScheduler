import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

// בדיקה אם המשתמש קיים במערכת, הצפנת סיסמה, ויצירת יוזר חדש
export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role, isFixedMorning } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.warn(`[Auth] Attempt to register existing email: ${email}`);
            return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
            isFixedMorning,
        });

        await newUser.save();

        // יצירת JWT token תקף ל-24 שעות
        const token = jwt.sign(
            { userId: newUser._id, role: newUser.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        console.log('✅ User registered:', newUser.email);
        console.log('🔐 Token generated for user:', newUser._id);

        const userResponse = newUser.toObject() as Record<string, any>;
        delete userResponse.password;

        return res.status(201).json({
            user: userResponse,
            token,
        });
    } catch (error) {
        console.error('❌ Error in register:', error);
        return res.status(500).json({ message: 'שגיאה פנימית בשרת' });
    }
};

// השוואת סיסמה מוצפנת, והתחברות מערכת
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'פרטי התחברות שגויים' });
        }

        if (!user.password) {
            return res.status(401).json({ message: 'פרטי התחברות שגויים' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'פרטי התחברות שגויים' });
        }

        // יצירת JWT token תקף ל-24 שעות
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        console.log('✅ User logged in:', user.email);
        console.log('🔐 Token generated for user:', user._id);

        const userResponse = user.toObject() as Record<string, any>;
        delete userResponse.password;

        return res.status(200).json({
            user: userResponse,
            token,
        });
    } catch (error) {
        console.error('❌ Error in login:', error);
        return res.status(500).json({ message: 'שגיאה פנימית בשרת' });
    }
};

// אחזור פרטי המשתמש המחובר
export const getMe = async (req: Request, res: Response) => {
    try {
        // req.user will be populated by auth middleware
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'משתמש לא מחובר' });
        }

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'משתמש לא נמצא' });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.error('❌ Error in getMe:', error);
        return res.status(500).json({ message: 'שגיאה פנימית בשרת' });
    }
};
