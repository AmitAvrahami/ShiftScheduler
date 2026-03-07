import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import userRoutes from '../../routes/user.routes';
import { User } from '../../models/User';

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

const generateToken = (userId: string, role: string) => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
};

describe('User Routes', () => {
    let managerToken: string;
    let employeeToken: string;
    let managerId: mongoose.Types.ObjectId;
    let employeeId: mongoose.Types.ObjectId;

    beforeEach(async () => {
        // Clear users before testing
        await User.deleteMany({});

        const manager = await User.create({
            name: 'Manager Test',
            email: 'manager@testroutes.com',
            password: 'password123',
            role: 'manager',
            isActive: true
        });
        managerId = manager._id as mongoose.Types.ObjectId;
        managerToken = generateToken(managerId.toString(), 'manager');

        const emp = await User.create({
            name: 'Active Employee',
            email: 'active@testroutes.com',
            password: 'password123',
            role: 'employee',
            isActive: true
        });
        employeeId = emp._id as mongoose.Types.ObjectId;
        employeeToken = generateToken(employeeId.toString(), 'employee');

        // Inactive user
        await User.create({
            name: 'Inactive Employee',
            email: 'inactive@testroutes.com',
            password: 'password123',
            role: 'employee',
            isActive: false
        });
    });

    afterAll(async () => {
        await User.deleteMany({});
    });

    describe('GET /api/users', () => {
        it('returns 200 with all active users for manager', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBe(2); // Manager + Active Employee

            const userNames = res.body.data.map((u: any) => u.name);
            expect(userNames).toContain('Manager Test');
            expect(userNames).toContain('Active Employee');
        });

        it('returns 403 for employee', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${employeeToken}`);

            expect(res.status).toBe(403);
        });

        it('returns 401 if not authenticated', async () => {
            const res = await request(app).get('/api/users');
            expect(res.status).toBe(401);
        });

        it('does NOT return password field', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data[0].password).toBeUndefined();
            expect(res.body.data[1].password).toBeUndefined();
        });

        it('does NOT return inactive users (isActive: false)', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${managerToken}`);

            expect(res.status).toBe(200);
            const userNames = res.body.data.map((u: any) => u.name);
            expect(userNames).not.toContain('Inactive Employee');
        });
    });
});
