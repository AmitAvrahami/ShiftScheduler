import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string, role: string };

        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        (req as any).user = { userId: decoded.userId, role: decoded.role };
        next();
    } catch (error) {
        console.error('❌ Token verification failed:', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

export const managerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (userRole !== 'manager') {
        return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }
    next();
};
