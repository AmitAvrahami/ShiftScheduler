import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import constraintRoutes from '../../routes/constraint.routes';
import { User } from '../../models/User';
import { Constraint } from '../../models/Constraint';

const app = express();
app.use(express.json());
app.use('/api/constraints', constraintRoutes);

const generateToken = (userId: string, role: string) => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
};

describe('Constraint Controller', () => {
    let managerToken: string;
    let employeeToken1: string;
    let employeeToken2: string;
    let managerId: mongoose.Types.ObjectId;
    let employeeId1: mongoose.Types.ObjectId;
    let employeeId2: mongoose.Types.ObjectId;

    beforeEach(async () => {
        // Seed users
        const manager = await User.create({
            name: 'Manager User',
            email: 'manager@test.com',
            password: 'password123',
            role: 'manager',
        });
        managerId = manager._id as mongoose.Types.ObjectId;
        managerToken = generateToken(managerId.toString(), 'manager');

        const emp1 = await User.create({
            name: 'Employee One',
            email: 'emp1@test.com',
            password: 'password123',
            role: 'employee',
        });
        employeeId1 = emp1._id as mongoose.Types.ObjectId;
        employeeToken1 = generateToken(employeeId1.toString(), 'employee');

        const emp2 = await User.create({
            name: 'Employee Two',
            email: 'emp2@test.com',
            password: 'password123',
            role: 'employee',
        });
        employeeId2 = emp2._id as mongoose.Types.ObjectId;
        employeeToken2 = generateToken(employeeId2.toString(), 'employee');
    });

    afterEach(async () => {
        await Constraint.deleteMany({});
    });

    describe('POST /api/constraints', () => {
        it('returns 200 on valid submission', async () => {
            const payload = {
                weekId: '2026-W11',
                constraints: [
                    { date: '2026-03-08T00:00:00.000Z', shift: 'morning', canWork: true }
                ]
            };
            const res = await request(app)
                .post('/api/constraints')
                .set('Authorization', `Bearer ${employeeToken1}`)
                .send(payload);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const saved = await Constraint.findOne({ userId: employeeId1, weekId: '2026-W11' });
            expect(saved).toBeDefined();
            expect(saved?.constraints.length).toBe(1);
        });

        it('returns 400 if weekId format is invalid', async () => {
            const payload = {
                weekId: 'invalid-week',
                constraints: []
            };
            const res = await request(app)
                .post('/api/constraints')
                .set('Authorization', `Bearer ${employeeToken1}`)
                .send(payload);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('returns 400 if constraints array is empty or malformed', async () => {
            const payload = {
                weekId: '2026-W11',
                constraints: []
            };
            const res = await request(app)
                .post('/api/constraints')
                .set('Authorization', `Bearer ${employeeToken1}`)
                .send(payload);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('returns 401 if no JWT token provided', async () => {
            const payload = {
                weekId: '2026-W11',
                constraints: [{ date: '2026-03-08T00:00:00.000Z', shift: 'morning', canWork: true }]
            };
            const res = await request(app).post('/api/constraints').send(payload);

            expect(res.status).toBe(401);
        });

        it('upsert works: submitting twice for same weekId replaces constraints', async () => {
            const payload1 = {
                weekId: '2026-W11',
                constraints: [{ date: '2026-03-08T00:00:00.000Z', shift: 'morning', canWork: true }]
            };
            await request(app)
                .post('/api/constraints')
                .set('Authorization', `Bearer ${employeeToken1}`)
                .send(payload1);

            const payload2 = {
                weekId: '2026-W11',
                constraints: [{ date: '2026-03-08T00:00:00.000Z', shift: 'afternoon', canWork: false }]
            };
            const res2 = await request(app)
                .post('/api/constraints')
                .set('Authorization', `Bearer ${employeeToken1}`)
                .send(payload2);

            expect(res2.status).toBe(200);

            const saved = await Constraint.findOne({ userId: employeeId1, weekId: '2026-W11' });
            expect(saved?.constraints.length).toBe(1);
            expect(saved?.constraints[0].shift).toBe('afternoon');
            expect(saved?.constraints[0].canWork).toBe(false);
            expect(saved?.submittedAt).toBeDefined();
        });

        it('returns 403 if the week is locked', async () => {
            // Create a locked constraint
            await Constraint.create({
                userId: employeeId1,
                weekId: '2026-W12',
                constraints: [{ date: new Date('2026-03-15'), shift: 'morning', canWork: true }],
                isLocked: true
            });

            const payload = {
                weekId: '2026-W12',
                constraints: [{ date: '2026-03-15T00:00:00.000Z', shift: 'night', canWork: false }]
            };
            const res = await request(app)
                .post('/api/constraints')
                .set('Authorization', `Bearer ${employeeToken1}`)
                .send(payload);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });

    describe('GET /api/constraints/my/:weekId', () => {
        it('returns 200 with the users own constraints', async () => {
            await Constraint.create({
                userId: employeeId1,
                weekId: '2026-W13',
                constraints: [{ date: new Date('2026-03-22'), shift: 'morning', canWork: true }]
            });

            const res = await request(app)
                .get('/api/constraints/my/2026-W13')
                .set('Authorization', `Bearer ${employeeToken1}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.constraints.length).toBe(1);
        });

        it('returns 200 with empty data if no constraints exist for that week', async () => {
            const res = await request(app)
                .get('/api/constraints/my/2026-W14')
                .set('Authorization', `Bearer ${employeeToken1}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBe(null); // Or returning an empty constraints array, depending on implementation
        });

        it('returns 401 if not authenticated', async () => {
            const res = await request(app).get('/api/constraints/my/2026-W13');
            expect(res.status).toBe(401);
        });

        it('does NOT return another users constraints', async () => {
            await Constraint.create({
                userId: employeeId2,
                weekId: '2026-W15',
                constraints: [{ date: new Date('2026-04-05'), shift: 'morning', canWork: true }]
            });

            const res = await request(app)
                .get('/api/constraints/my/2026-W15')
                .set('Authorization', `Bearer ${employeeToken1}`); // Requesting with emp1 token

            expect(res.status).toBe(200);
            // Wait, emp1 should not see emp2's constraints. So it returns null/empty.
            // Wait wait, GET /api/constraints/my/:weekId always filters by req.user.userId
            // Let's assert that data returned is null or empty
            expect(res.body.data).toBe(null);
        });
    });

    describe('GET /api/constraints/week/:weekId', () => {
        it('returns 200 with all employees constraints for the week and populates userId', async () => {
            await Constraint.create({
                userId: employeeId1,
                weekId: '2026-W16',
                constraints: [{ date: new Date('2026-04-12'), shift: 'morning', canWork: true }]
            });

            const res = await request(app)
                .get('/api/constraints/week/2026-W16')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].userId.name).toBe('Employee One');
            expect(res.body.data[0].userId.email).toBe('emp1@test.com');
        });

        it('returns 403 if called by an employee', async () => {
            const res = await request(app)
                .get('/api/constraints/week/2026-W16')
                .set('Authorization', `Bearer ${employeeToken1}`);

            expect(res.status).toBe(403);
        });

        it('returns 401 if not authenticated', async () => {
            const res = await request(app).get('/api/constraints/week/2026-W16');
            expect(res.status).toBe(401);
        });
    });

    describe('PATCH /api/constraints/lock/:weekId', () => {
        it('returns 200 and locks all documents for that weekId', async () => {
            await Constraint.create({
                userId: employeeId1,
                weekId: '2026-W17',
                constraints: []
            });
            await Constraint.create({
                userId: employeeId2,
                weekId: '2026-W17',
                constraints: []
            });

            const res = await request(app)
                .patch('/api/constraints/lock/2026-W17')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.lockedCount).toBeDefined();

            const locked1 = await Constraint.findOne({ userId: employeeId1, weekId: '2026-W17' });
            const locked2 = await Constraint.findOne({ userId: employeeId2, weekId: '2026-W17' });

            expect(locked1?.isLocked).toBe(true);
            expect(locked2?.isLocked).toBe(true);
        });

        it('returns 403 if called by an employee', async () => {
            const res = await request(app)
                .patch('/api/constraints/lock/2026-W17')
                .set('Authorization', `Bearer ${employeeToken1}`);

            expect(res.status).toBe(403);
        });

    });

    describe('PATCH /api/constraints/unlock/:weekId', () => {
        it('returns 403 if called by an employee', async () => {
            const res = await request(app)
                .patch('/api/constraints/unlock/2026-W17')
                .set('Authorization', `Bearer ${employeeToken1}`);

            expect(res.status).toBe(403);
        });

        it('unlocks all documents for that weekId and allows employees to resubmit', async () => {
            await Constraint.create({
                userId: employeeId1,
                weekId: '2026-W19',
                constraints: [],
                isLocked: true
            });
            await Constraint.create({
                userId: employeeId2,
                weekId: '2026-W19',
                constraints: [],
                isLocked: true
            });

            const res = await request(app)
                .patch('/api/constraints/unlock/2026-W19')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.unlockedCount).toBeDefined();

            const doc1 = await Constraint.findOne({ userId: employeeId1, weekId: '2026-W19' });
            const doc2 = await Constraint.findOne({ userId: employeeId2, weekId: '2026-W19' });
            expect(doc1?.isLocked).toBe(false);
            expect(doc2?.isLocked).toBe(false);
        });

        it('after unlock: POST /api/constraints succeeds for that weekId', async () => {
            await Constraint.create({
                userId: employeeId1,
                weekId: '2026-W21',
                constraints: [],
                isLocked: true
            });

            await request(app)
                .patch('/api/constraints/unlock/2026-W21')
                .set('Authorization', `Bearer ${managerToken}`);

            const payload = {
                weekId: '2026-W21',
                constraints: [{ date: '2026-05-17T00:00:00.000Z', shift: 'morning', canWork: true }]
            };

            const res = await request(app)
                .post('/api/constraints')
                .set('Authorization', `Bearer ${employeeToken1}`)
                .send(payload);

            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/constraints/lock/:weekId', () => {
        it('after lock: POST /api/constraints returns 403 for that weekId', async () => {
            // Seed constraint so we have something to lock
            await Constraint.create({
                userId: employeeId2,
                weekId: '2026-W18',
                constraints: []
            });

            // Lock first
            await request(app)
                .patch('/api/constraints/lock/2026-W18')
                .set('Authorization', `Bearer ${managerToken}`);

            // Try to submit
            const payload = {
                weekId: '2026-W18',
                constraints: [{ date: '2026-04-19T00:00:00.000Z', shift: 'morning', canWork: true }]
            };

            // We will need to make sure the constraint document existed when we locked it, or 
            // the controller checks if the week is locked generally? 
            // The user instructs: "After lock: POST /api/constraints returns 403 for that weekId".
            // We'll see how the controller is implemented, but the test requirement is clear.

            const res = await request(app)
                .post('/api/constraints')
                .set('Authorization', `Bearer ${employeeToken1}`)
                .send(payload);

            expect(res.status).toBe(403);
        });
    });

});
