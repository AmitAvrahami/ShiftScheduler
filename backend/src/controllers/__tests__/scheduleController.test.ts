import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import scheduleRoutes from '../../routes/schedule.routes';
import { User } from '../../models/User';
import { Schedule } from '../../models/Schedule';
import { Notification } from '../../models/Notification';

const app = express();
app.use(express.json());
app.use('/api/schedules', scheduleRoutes);

const generateToken = (userId: string, role: string) =>
    jwt.sign({ userId, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

describe('Schedule Controller', () => {
    const TEST_WEEK_ID = '2026-W20'; // Choose a future week to avoid deadline issues

    let managerToken: string;
    let employeeToken: string;
    let managerId: mongoose.Types.ObjectId;
    let employeeId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        const manager = await User.create({
            name: 'Manager',
            email: 'manager@test.com',
            password: 'pw',
            role: 'manager',
            isActive: true,
        });
        managerId = manager._id as mongoose.Types.ObjectId;
        managerToken = generateToken(managerId.toString(), 'manager');

        // Create several employees so the algorithm has enough people to fill shifts
        const empUsers = await User.create([
            { name: 'Emp1', email: 'emp1@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Emp2', email: 'emp2@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Emp3', email: 'emp3@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Emp4', email: 'emp4@test.com', password: 'pw', role: 'employee', isActive: true },
        ]);
        employeeId = empUsers[0]._id as mongoose.Types.ObjectId;
        employeeToken = generateToken(employeeId.toString(), 'employee');
    });

    // ─── POST /api/schedules/generate ─────────────────────────────────────────

    describe('POST /api/schedules/generate', () => {
        it('returns 200 with schedule and warnings for manager', async () => {
            const res = await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.schedule).toBeDefined();
            expect(res.body.data.schedule.shifts).toHaveLength(21);
            expect(Array.isArray(res.body.data.warnings)).toBe(true);
        });

        it('returns 403 if called by employee', async () => {
            const res = await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${employeeToken}`)
                .send({ weekId: TEST_WEEK_ID });

            expect(res.status).toBe(403);
        });

        it('returns 401 if not authenticated', async () => {
            const res = await request(app)
                .post('/api/schedules/generate')
                .send({ weekId: TEST_WEEK_ID });

            expect(res.status).toBe(401);
        });

        it('returns 400 if schedule is already published', async () => {
            // Generate first
            await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            // Publish it manually
            await Schedule.updateOne({}, { isPublished: true });

            // Try to generate again
            const res = await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('הסידור כבר פורסם ולא ניתן לשנות');
        });

        it('can regenerate schedule if not yet published', async () => {
            await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            const res = await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            expect(res.status).toBe(200);
        });

        it('returns 400 for invalid weekId format', async () => {
            const res = await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: 'not-a-weekid' });

            expect(res.status).toBe(400);
        });
    });

    // ─── GET /api/schedules/:weekId ────────────────────────────────────────────

    describe('GET /api/schedules/:weekId', () => {
        it('manager can see unpublished schedule', async () => {
            await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            const res = await request(app)
                .get(`/api/schedules/${TEST_WEEK_ID}`)
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.isPublished).toBe(false);
        });

        it('employee receives 404 if schedule not published', async () => {
            await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            const res = await request(app)
                .get(`/api/schedules/${TEST_WEEK_ID}`)
                .set('Authorization', `Bearer ${employeeToken}`);

            expect(res.status).toBe(404);
            expect(res.body.message).toBe('הסידור טרם פורסם');
        });

        it('employee can see published schedule', async () => {
            await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/publish`)
                .set('Authorization', `Bearer ${managerToken}`);

            const res = await request(app)
                .get(`/api/schedules/${TEST_WEEK_ID}`)
                .set('Authorization', `Bearer ${employeeToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.isPublished).toBe(true);
        });

        it('returns 404 if no schedule exists for weekId', async () => {
            const res = await request(app)
                .get('/api/schedules/2026-W99')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(404);
        });
    });

    // ─── PATCH /api/schedules/:weekId/publish ─────────────────────────────────

    describe('PATCH /api/schedules/:weekId/publish', () => {
        it('sets isPublished=true and creates notifications for active users', async () => {
            await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            const res = await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/publish`)
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.isPublished).toBe(true);

            // Notifications should exist for all active users
            const notifications = await Notification.find({ weekId: TEST_WEEK_ID });
            const totalActiveUsers = await User.countDocuments({ isActive: true });
            expect(notifications.length).toBe(totalActiveUsers);
        });

        it('returns 403 if called by employee', async () => {
            const res = await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/publish`)
                .set('Authorization', `Bearer ${employeeToken}`);

            expect(res.status).toBe(403);
        });

        it('returns 404 if no schedule for weekId', async () => {
            const res = await request(app)
                .patch('/api/schedules/2026-W99/publish')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(404);
        });
    });

    // ─── GET /api/schedules/:weekId/my ────────────────────────────────────────

    describe('GET /api/schedules/:weekId/my', () => {
        it('employee receives 404 if schedule not published', async () => {
            await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            const res = await request(app)
                .get(`/api/schedules/${TEST_WEEK_ID}/my`)
                .set('Authorization', `Bearer ${employeeToken}`);

            expect(res.status).toBe(404);
        });

        it('returns my shifts after publish', async () => {
            await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/publish`)
                .set('Authorization', `Bearer ${managerToken}`);

            const res = await request(app)
                .get(`/api/schedules/${TEST_WEEK_ID}/my`)
                .set('Authorization', `Bearer ${employeeToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    // ─── PATCH /api/schedules/:weekId/shifts ──────────────────────────────────

    describe('PATCH /api/schedules/:weekId/shifts', () => {
        /**
         * Helper: generate a draft schedule and return its first shift data
         * so tests can build valid replacement payloads.
         */
        const generateAndGetSchedule = async () => {
            const genRes = await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });
            return genRes.body.data.schedule;
        };

        it('manager can replace shifts successfully and receives 200', async () => {
            const generatedSchedule = await generateAndGetSchedule();

            // Build a minimal shifts payload using the first shift's employees
            const firstShift = generatedSchedule.shifts[0];
            const payload = {
                shifts: [
                    {
                        date: firstShift.date,
                        type: firstShift.type,
                        employees: firstShift.employees.map((e: { _id: string }) => e._id),
                    },
                ],
            };

            const res = await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/shifts`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send(payload);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.shifts).toHaveLength(1);
        });

        it('manager can set shifts to empty array (clear schedule)', async () => {
            await generateAndGetSchedule();

            const res = await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/shifts`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ shifts: [] });

            expect(res.status).toBe(200);
            expect(res.body.data.shifts).toHaveLength(0);
        });

        it('returns 403 if called by employee', async () => {
            await generateAndGetSchedule();

            const res = await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/shifts`)
                .set('Authorization', `Bearer ${employeeToken}`)
                .send({ shifts: [] });

            expect(res.status).toBe(403);
        });

        it('returns 401 if not authenticated', async () => {
            const res = await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/shifts`)
                .send({ shifts: [] });

            expect(res.status).toBe(401);
        });

        it('allows editing a published schedule and sends notifications to active users', async () => {
            // Generate and publish
            const genRes = await request(app)
                .post('/api/schedules/generate')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ weekId: TEST_WEEK_ID });

            await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/publish`)
                .set('Authorization', `Bearer ${managerToken}`);

            // Clear existing notifications
            await Notification.deleteMany({ weekId: TEST_WEEK_ID });

            // Now edit the published schedule
            const validShifts = genRes.body.data.schedule.shifts.map((s: any) => ({
                date: s.date,
                type: s.type,
                employees: s.employees.map((e: any) => e._id ?? e),
            }));

            const res = await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/shifts`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ shifts: validShifts });

            expect(res.status).toBe(200);

            // Notifications should have been created for all active users
            const notifications = await Notification.find({ weekId: TEST_WEEK_ID });
            const activeUserCount = await User.countDocuments({ isActive: true });
            expect(notifications.length).toBe(activeUserCount);
            expect(notifications[0].message).toBe('סידור העבודה עודכן על ידי המנהל — בדוק את השינויים');
        });

        it('returns 404 if no schedule found for weekId', async () => {
            const res = await request(app)
                .patch('/api/schedules/2026-W99/shifts')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ shifts: [] });

            expect(res.status).toBe(404);
            expect(res.body.message).toBe('לא נמצא סידור לשבוע זה');
        });

        it('returns 400 for invalid weekId format', async () => {
            const res = await request(app)
                .patch('/api/schedules/bad-id/shifts')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ shifts: [] });

            expect(res.status).toBe(400);
        });

        it('returns 400 if an employee ObjectId is not a valid MongoDB id', async () => {
            await generateAndGetSchedule();

            const payload = {
                shifts: [
                    {
                        date: new Date().toISOString(),
                        type: 'morning',
                        employees: ['not-a-valid-objectid'],
                    },
                ],
            };

            const res = await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/shifts`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send(payload);

            expect(res.status).toBe(400);
        });

        it('returns 400 if an employee ObjectId does not exist in Users collection', async () => {
            await generateAndGetSchedule();

            const nonExistentId = new mongoose.Types.ObjectId().toString();
            const payload = {
                shifts: [
                    {
                        date: new Date().toISOString(),
                        type: 'morning',
                        employees: [nonExistentId],
                    },
                ],
            };

            const res = await request(app)
                .patch(`/api/schedules/${TEST_WEEK_ID}/shifts`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send(payload);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('אחד או יותר מהעובדים לא נמצאו במערכת');
        });
    });
});
