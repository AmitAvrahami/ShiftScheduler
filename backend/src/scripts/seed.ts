import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import User from '../models/User';

const seedUsers = [
  {
    name: 'מנהל מערכת',
    email: 'admin@shiftscheduler.com',
    password: 'Admin1234!',
    role: 'admin' as const,
  },
  {
    name: 'עובד לדוגמה',
    email: 'employee@shiftscheduler.com',
    password: 'Employee1234!',
    role: 'employee' as const,
  },
];

async function seed(): Promise<void> {
  await connectDB();

  for (const userData of seedUsers) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      console.log(`User already exists, skipping: ${userData.email}`);
      continue;
    }
    const user = new User(userData);
    await user.save(); // triggers pre-save bcrypt hook
    console.log(`Created ${userData.role}: ${userData.email}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err: Error) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
