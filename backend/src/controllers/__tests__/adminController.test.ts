import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import adminRoutes from '../../routes/admin.routes';
import { User } from '../../models/User';
import { Schedule } from '../../models/Schedule';
import { Constraint } from '../../models/Constraint';
import { getWeekDates } from '../../utils/weekUtils';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

const generateToken = (userId: string, role: string) =>
    jwt.sign({ userId, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

describe('Admin Controller', () => {
    let adminToken: string;
    let managerToken: string;
    let employeeToken: string;
    let adminId: mongoose.Types.ObjectId;
    let employeeId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@test.com',
            password: 'hashed',
            role: 'admin',
            isActive: true,
        });
        adminId = admin._id as mongoose.Types.ObjectId;
        adminToken = generateToken(adminId.toString(), 'admin');

        const manager = await User.create({
            name: 'Manager User',
            email: 'manager@test.com',
            password: 'hashed',
            role: 'manager',
            isActive: true,
        });
        managerToken = generateToken((manager._id as mongoose.Types.ObjectId).toString(), 'manager');

        const emp = await User.create({
            name: 'Employee User',
            email: 'emp@test.com',
            password: 'hashed',
            role: 'employee',
            isActive: true,
        });
        employeeId = emp._id as mongoose.Types.ObjectId;
        employeeToken = generateToken(employeeId.toString(), 'employee');
    });

    // ─── Auth / Role Guards ────────────────────────────────────────────────────

    describe('Role guards', () => {
        it('returns 401 for unauthenticated requests', async () => {
            const res = await request(app).get('/api/admin/stats');
            expect(res.status).toBe(401);
        });

        it('returns 403 for manager on admin routes', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${managerToken}`);
            expect(res.status).toBe(403);
        });

        it('returns 403 for employee on admin routes', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${employeeToken}`);
            expect(res.status).toBe(403);
        });
    });

    // ─── GET /api/admin/stats ─────────────────────────────────────────────────

    describe('GET /api/admin/stats', () => {
        it('returns aggregate stats for admin', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalUsers).toBe(3); // admin + manager + employee
            expect(res.body.data.activeManagers).toBe(1);
            expect(res.body.data.activeEmployees).toBe(1);
            expect(res.body.data.totalSchedules).toBe(0);
            expect(res.body.data.publishedSchedules).toBe(0);
            expect(res.body.data.totalConstraints).toBe(0);
        });
    });

    // ─── GET /api/admin/users ─────────────────────────────────────────────────

    describe('GET /api/admin/users', () => {
        it('returns all users including inactive', async () => {
            await User.create({
                name: 'Inactive',
                email: 'inactive@test.com',
                password: 'pw',
                role: 'employee',
                isActive: false,
            });

            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(4); // admin + manager + emp + inactive
        });

        it('does not return password field', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            res.body.data.forEach((u: any) => {
                expect(u.password).toBeUndefined();
            });
        });
    });

    // ─── POST /api/admin/users ────────────────────────────────────────────────

    describe('POST /api/admin/users', () => {
        it('creates a user of any role including admin', async () => {
            const res = await request(app)
                .post('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'New Admin',
                    email: 'newadmin@test.com',
                    password: 'password123',
                    role: 'admin',
                });

            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('admin');
            expect(res.body.data.password).toBeUndefined();
        });

        it('creates a manager user', async () => {
            const res = await request(app)
                .post('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'New Manager',
                    email: 'newmgr@test.com',
                    password: 'password123',
                    role: 'manager',
                });

            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('manager');
        });

        it('returns 400 on duplicate email', async () => {
            const res = await request(app)
                .post('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Dup',
                    email: 'admin@test.com',
                    password: 'password123',
                    role: 'employee',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('returns 400 on invalid email format', async () => {
            const res = await request(app)
                .post('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Bad Email',
                    email: 'not-an-email',
                    password: 'password123',
                    role: 'employee',
                });

            expect(res.status).toBe(400);
        });

        it('returns 400 on short password', async () => {
            const res = await request(app)
                .post('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Short',
                    email: 'short@test.com',
                    password: '123',
                    role: 'employee',
                });

            expect(res.status).toBe(400);
        });
    });

    // ─── PATCH /api/admin/users/:id ───────────────────────────────────────────

    describe('PATCH /api/admin/users/:id', () => {
        it('updates user name and role', async () => {
            const res = await request(app)
                .patch(`/api/admin/users/${employeeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated Name', role: 'manager' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Name');
            expect(res.body.data.role).toBe('manager');
        });

        it('returns 404 for non-existent user', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/admin/users/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Ghost' });

            expect(res.status).toBe(404);
        });

        it('blocks demoting the last admin', async () => {
            const res = await request(app)
                .patch(`/api/admin/users/${adminId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ role: 'manager' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('מנהל-העל האחרון');
        });

        it('allows demoting admin when another admin exists', async () => {
            const secondAdmin = await User.create({
                name: 'Second Admin',
                email: 'admin2@test.com',
                password: 'pw',
                role: 'admin',
                isActive: true,
            });

            const res = await request(app)
                .patch(`/api/admin/users/${adminId}`)
                .set('Authorization', `Bearer ${generateToken(secondAdmin._id.toString(), 'admin')}`)
                .send({ role: 'manager' });

            expect(res.status).toBe(200);
            expect(res.body.data.role).toBe('manager');
        });

        it('returns 400 on duplicate email', async () => {
            const res = await request(app)
                .patch(`/api/admin/users/${employeeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ email: 'manager@test.com' }); // already taken

            expect(res.status).toBe(400);
        });
    });

    // ─── DELETE /api/admin/users/:id (soft) ──────────────────────────────────

    describe('DELETE /api/admin/users/:id (soft deactivate)', () => {
        it('deactivates a user without removing from DB', async () => {
            const res = await request(app)
                .delete(`/api/admin/users/${employeeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            const updated = await User.findById(employeeId);
            expect(updated?.isActive).toBe(false);
        });

        it('blocks deactivating the last admin', async () => {
            const res = await request(app)
                .delete(`/api/admin/users/${adminId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            const stillExists = await User.findById(adminId);
            expect(stillExists).not.toBeNull();
        });

        it('returns 400 for invalid ObjectId', async () => {
            const res = await request(app)
                .delete('/api/admin/users/not-a-valid-id')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
        });
    });

    // ─── DELETE /api/admin/users/:id?hard=true ───────────────────────────────

    describe('DELETE /api/admin/users/:id?hard=true (permanent)', () => {
        it('permanently removes a user from the database', async () => {
            const res = await request(app)
                .delete(`/api/admin/users/${employeeId}?hard=true`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            const found = await User.findById(employeeId);
            expect(found).toBeNull();
        });

        it('blocks hard-deleting the last admin', async () => {
            const res = await request(app)
                .delete(`/api/admin/users/${adminId}?hard=true`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            const stillExists = await User.findById(adminId);
            expect(stillExists).not.toBeNull();
        });

        it('returns 404 for non-existent user', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .delete(`/api/admin/users/${fakeId}?hard=true`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });

    // ─── GET /api/admin/constraints ───────────────────────────────────────────

    describe('GET /api/admin/constraints', () => {
        it('returns all constraints without filter', async () => {
            await Constraint.create({
                userId: employeeId,
                weekId: '2026-W20',
                constraints: [],
                submittedAt: new Date(),
                isLocked: false,
            });
            await Constraint.create({
                userId: employeeId,
                weekId: '2026-W21',
                constraints: [],
                submittedAt: new Date(),
                isLocked: false,
            });

            const res = await request(app)
                .get('/api/admin/constraints')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });

        it('filters constraints by weekId', async () => {
            await Constraint.create({
                userId: employeeId,
                weekId: '2026-W20',
                constraints: [],
                submittedAt: new Date(),
                isLocked: false,
            });
            await Constraint.create({
                userId: employeeId,
                weekId: '2026-W21',
                constraints: [],
                submittedAt: new Date(),
                isLocked: false,
            });

            const res = await request(app)
                .get('/api/admin/constraints?weekId=2026-W20')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].weekId).toBe('2026-W20');
        });

        it('returns 400 for invalid weekId format', async () => {
            const res = await request(app)
                .get('/api/admin/constraints?weekId=bad-format')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
        });
    });

    // ─── PATCH /api/admin/constraints/:userId/:weekId ─────────────────────────

    describe('PATCH /api/admin/constraints/:userId/:weekId', () => {
        it('creates a constraint doc and locks it', async () => {
            const res = await request(app)
                .patch(`/api/admin/constraints/${employeeId}/2026-W22`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    constraints: [
                        { date: new Date('2026-05-24'), shift: 'morning', canWork: false },
                    ],
                });

            expect(res.status).toBe(200);
            expect(res.body.data.isLocked).toBe(true);
            expect(res.body.data.constraints).toHaveLength(1);
        });

        it('returns 404 for non-existent user', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await request(app)
                .patch(`/api/admin/constraints/${fakeId}/2026-W22`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ constraints: [] });

            expect(res.status).toBe(404);
        });

        it('returns 400 for invalid userId', async () => {
            const res = await request(app)
                .patch('/api/admin/constraints/not-valid/2026-W22')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ constraints: [] });

            expect(res.status).toBe(400);
        });
    });

    // ─── GET /api/admin/schedules ─────────────────────────────────────────────

    describe('GET /api/admin/schedules', () => {
        it('returns all schedules including old ones', async () => {
            await Schedule.create({
                weekStartDate: getWeekDates('2024-W02')[0], // past week
                shifts: [],
                isPublished: true,
            });
            await Schedule.create({
                weekStartDate: getWeekDates('2026-W20')[0], // future week
                shifts: [],
                isPublished: false,
            });

            const res = await request(app)
                .get('/api/admin/schedules')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });

        it('does not return shifts array (metadata only)', async () => {
            const weekStart = getWeekDates('2026-W20')[0];
            await Schedule.create({
                weekStartDate: weekStart,
                shifts: [{ date: weekStart, type: 'morning', employees: [] }],
                isPublished: false,
            });

            const res = await request(app)
                .get('/api/admin/schedules')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            // shifts should be excluded from the select
            res.body.data.forEach((s: any) => {
                expect(s.shifts).toBeUndefined();
            });
        });
    });

    // ─── DELETE /api/admin/schedules/:weekId ─────────────────────────────────

    describe('DELETE /api/admin/schedules/:weekId', () => {
        it('force-deletes a past schedule that manager cannot delete', async () => {
            const PAST_WEEK = '2024-W02';
            await Schedule.create({
                weekStartDate: getWeekDates(PAST_WEEK)[0], // local midnight, matching controller
                shifts: [],
                isPublished: false,
            });

            const res = await request(app)
                .delete(`/api/admin/schedules/${PAST_WEEK}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('force-deletes a published schedule', async () => {
            const PAST_WEEK = '2024-W02';
            const weekStart = getWeekDates(PAST_WEEK)[0];
            await Schedule.create({
                weekStartDate: weekStart,
                shifts: [],
                isPublished: true,
            });

            const res = await request(app)
                .delete(`/api/admin/schedules/${PAST_WEEK}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            const gone = await Schedule.findOne({ weekStartDate: weekStart });
            expect(gone).toBeNull();
        });

        it('returns 404 for non-existent schedule', async () => {
            const res = await request(app)
                .delete('/api/admin/schedules/2023-W01')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });

        it('returns 400 for invalid weekId format', async () => {
            const res = await request(app)
                .delete('/api/admin/schedules/bad-format')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
        });

        it('returns 403 for manager attempting to delete via admin route', async () => {
            const res = await request(app)
                .delete('/api/admin/schedules/2024-W02')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(403);
        });
    });
});
