import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { connectDB } from './config/db';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import constraintRoutes from './routes/constraint.routes';
import scheduleRoutes from './routes/schedule.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Main Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/constraints', constraintRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Error Handling
app.use(errorHandler);

const startServer = async () => {
    await connectDB();
    app.listen(env.PORT, () => {
        console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
};

startServer();
