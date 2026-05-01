import 'dotenv/config';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import User from '../models/User';
import WeeklySchedule from '../models/WeeklySchedule';
import AuditLog from '../models/AuditLog';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

function makeToken(user: { _id: unknown; email: string; role: string }): string {
  return jwt.sign(
    { _id: String(user._id), email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

async function seedAdmin() {
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    password: 'pass12345',
    role: 'admin',
  });
  return { admin, token: makeToken(admin) };
}

async function seedManager() {
  const manager = await User.create({
    name: 'Manager',
    email: 'manager@test.com',
    password: 'pass12345',
    role: 'manager',
  });
  return { manager, token: makeToken(manager) };
}

async function seedEmployee() {
  const employee = await User.create({
    name: 'Employee',
    email: 'employee@test.com',
    password: 'pass12345',
    role: 'employee',
  });
  return { employee, token: makeToken(employee) };
}

describe('GET /api/v1/admin/dashboard — access control', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns 403 for employee token', async () => {
    const { token } = await seedEmployee();
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for manager token', async () => {
    const { token } = await seedManager();
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 for admin token', async () => {
    const { token } = await seedAdmin();
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/admin/dashboard — response shape', () => {
  it('returns correct top-level keys', async () => {
    const { token } = await seedAdmin();
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveProperty('users');
    expect(res.body.data).toHaveProperty('schedules');
    expect(res.body.data).toHaveProperty('recentAuditLogs');
  });

  it('users stat has required fields', async () => {
    const { token } = await seedAdmin();
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    const { users } = res.body.data;
    expect(typeof users.total).toBe('number');
    expect(typeof users.active).toBe('number');
    expect(users.byRole).toHaveProperty('employee');
    expect(users.byRole).toHaveProperty('manager');
    expect(users.byRole).toHaveProperty('admin');
  });

  it('schedules stat has required fields', async () => {
    const { token } = await seedAdmin();
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    const { schedules } = res.body.data;
    expect(typeof schedules.total).toBe('number');
    expect(typeof schedules.byStatus).toBe('object');
  });

  it('recentAuditLogs is an array', async () => {
    const { token } = await seedAdmin();
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(Array.isArray(res.body.data.recentAuditLogs)).toBe(true);
  });
});

describe('GET /api/v1/admin/dashboard — data accuracy', () => {
  it('counts users correctly after seeding', async () => {
    const { admin, token } = await seedAdmin();
    await seedManager();
    await seedEmployee();

    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    const { users } = res.body.data;
    expect(users.total).toBe(3);
    expect(users.active).toBe(3);
    expect(users.byRole.admin).toBe(1);
    expect(users.byRole.manager).toBe(1);
    expect(users.byRole.employee).toBe(1);

    void admin; // referenced for clarity
  });

  it('inactive users are excluded from active count', async () => {
    const { token } = await seedAdmin();
    await User.create({
      name: 'Inactive',
      email: 'inactive@test.com',
      password: 'pass12345',
      role: 'employee',
      isActive: false,
    });

    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    const { users } = res.body.data;
    expect(users.total).toBe(2);
    expect(users.active).toBe(1);
  });

  it('counts schedules by status', async () => {
    const { token, admin } = await seedAdmin();
    await WeeklySchedule.create([
      { weekId: '2026-W01', startDate: new Date('2026-01-04'), endDate: new Date('2026-01-10'), status: 'open', generatedBy: 'manual', createdBy: admin._id },
      { weekId: '2026-W02', startDate: new Date('2026-01-11'), endDate: new Date('2026-01-17'), status: 'published', generatedBy: 'auto', createdBy: admin._id },
      { weekId: '2026-W03', startDate: new Date('2026-01-18'), endDate: new Date('2026-01-24'), status: 'published', generatedBy: 'auto', createdBy: admin._id },
    ]);

    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    const { schedules } = res.body.data;
    expect(schedules.total).toBe(3);
    expect(schedules.byStatus.open).toBe(1);
    expect(schedules.byStatus.published).toBe(2);
  });

  it('recentAuditLogs returns at most 10 entries', async () => {
    const { token, admin } = await seedAdmin();
    const logs = Array.from({ length: 15 }, (_, i) => ({
      performedBy: admin._id,
      action: `action_${i}`,
    }));
    await AuditLog.insertMany(logs);

    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data.recentAuditLogs.length).toBeLessThanOrEqual(10);
  });

  it('recentAuditLogs entries have action, performedBy, createdAt', async () => {
    const { token, admin } = await seedAdmin();
    await AuditLog.create({ performedBy: admin._id, action: 'user_created' });

    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    const [log] = res.body.data.recentAuditLogs;
    expect(log).toHaveProperty('action', 'user_created');
    expect(log).toHaveProperty('performedBy');
    expect(log).toHaveProperty('createdAt');
  });
});
