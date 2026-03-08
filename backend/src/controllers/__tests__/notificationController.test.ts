import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import notificationRoutes from '../../routes/notification.routes';
import { User } from '../../models/User';
import { Notification } from '../../models/Notification';

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationRoutes);

const generateToken = (userId: string, role: string) =>
    jwt.sign({ userId, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

describe('Notification Controller', () => {
    let userAToken: string;
    let userBToken: string;
    let userAId: mongoose.Types.ObjectId;
    let userBId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        const userA = await User.create({
            name: 'User A',
            email: 'usera@test.com',
            password: 'pw',
            role: 'employee',
        });
        userAId = userA._id as mongoose.Types.ObjectId;
        userAToken = generateToken(userAId.toString(), 'employee');

        const userB = await User.create({
            name: 'User B',
            email: 'userb@test.com',
            password: 'pw',
            role: 'employee',
        });
        userBId = userB._id as mongoose.Types.ObjectId;
        userBToken = generateToken(userBId.toString(), 'employee');
    });

    // ─── GET /api/notifications ────────────────────────────────────────────────

    describe('GET /api/notifications', () => {
        it('returns 200 with only unread notifications for the requesting user', async () => {
            await Notification.create([
                { userId: userAId, type: 'schedule_published', message: 'Test A', weekId: '2026-W11', isRead: false },
                { userId: userBId, type: 'schedule_published', message: 'Test B', weekId: '2026-W11', isRead: false },
            ]);

            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${userAToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.notifications).toHaveLength(1);
            expect(res.body.data.notifications[0].message).toBe('Test A');
            expect(res.body.data.unreadCount).toBe(1);
        });

        it('does not return already-read notifications', async () => {
            await Notification.create({
                userId: userAId,
                type: 'schedule_published',
                message: 'Already read',
                weekId: '2026-W11',
                isRead: true,
            });

            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${userAToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.notifications).toHaveLength(0);
            expect(res.body.data.unreadCount).toBe(0);
        });

        it('returns 401 if not authenticated', async () => {
            const res = await request(app).get('/api/notifications');
            expect(res.status).toBe(401);
        });
    });

    // ─── PATCH /api/notifications/:id/read ────────────────────────────────────

    describe('PATCH /api/notifications/:id/read', () => {
        it('marks own notification as read', async () => {
            const notification = await Notification.create({
                userId: userAId,
                type: 'schedule_published',
                message: 'Mark me',
                weekId: '2026-W11',
                isRead: false,
            });

            const res = await request(app)
                .patch(`/api/notifications/${notification._id}/read`)
                .set('Authorization', `Bearer ${userAToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isRead).toBe(true);
        });

        it('returns 403 when trying to mark another user notification as read', async () => {
            const notification = await Notification.create({
                userId: userBId,
                type: 'schedule_published',
                message: 'User B notification',
                weekId: '2026-W11',
                isRead: false,
            });

            const res = await request(app)
                .patch(`/api/notifications/${notification._id}/read`)
                .set('Authorization', `Bearer ${userAToken}`); // User A tries to mark User B's notification

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        it('returns 404 for non-existent notification id', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/notifications/${fakeId}/read`)
                .set('Authorization', `Bearer ${userAToken}`);

            expect(res.status).toBe(404);
        });

        it('returns 401 if not authenticated', async () => {
            const notification = await Notification.create({
                userId: userAId,
                type: 'schedule_published',
                message: 'Test',
                weekId: '2026-W11',
                isRead: false,
            });
            const res = await request(app).patch(`/api/notifications/${notification._id}/read`);
            expect(res.status).toBe(401);
        });
    });
});
