import express from 'express';
import { register, login, getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest, registerSchema, loginSchema } from '../middleware/validation';

const router = express.Router();

// Public routes
router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);

// Protected routes
router.get('/me', authenticate, getMe);

export default router;
