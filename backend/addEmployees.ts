import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from './src/models/User';

dotenv.config();

const employees = [
  { name: 'שני טקה',       email: 'shani_taka@shiftscheduler.com' },
  { name: 'מסי אסנקה',     email: 'mesi_asnaka@shiftscheduler.com' },
  { name: 'אופק כהן',      email: 'ofek_cohen@shiftscheduler.com' },
  { name: 'בר בור',        email: 'bar_bor@shiftscheduler.com' },
  { name: 'שחר ויינברג',   email: 'shahar_weinberg@shiftscheduler.com' },
  { name: 'פולינה לזרוב',  email: 'polina_lazarov@shiftscheduler.com' },
  { name: 'לאורה ערב',     email: 'laura_erev@shiftscheduler.com' },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI!);
  console.log('Connected to MongoDB');

  const hashedPassword = await bcrypt.hash('Aa123456!', 10);

  const docs = employees.map(({ name, email }) => ({
    name,
    email,
    password: hashedPassword,
    role: 'employee' as const,
    isActive: true,
    isFixedMorning: false,
  }));

  let added = 0;
  let skipped = 0;

  try {
    const result = await User.insertMany(docs, { ordered: false });
    added = result.length;
  } catch (err: any) {
    if (err.code === 11000 || err.name === 'MongoBulkWriteError') {
      added = err.result?.nInserted ?? 0;
      skipped = docs.length - added;
    } else {
      throw err;
    }
  }

  skipped = docs.length - added;

  console.log(`✅ Added: ${added} employees`);
  console.log(`⚠️  Skipped (already exist): ${skipped}`);

  // Print all active employees
  console.log('\nActive employees in DB:');
  const activeUsers = await User.find({ isActive: true }, { name: 1, email: 1, role: 1 }).lean();
  activeUsers.forEach(u => console.log(`  ${u.name} | ${u.email} | ${u.role}`));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
