import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seedUsers = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env');
        }

        await mongoose.connect(process.env.MONGO_URI);

        // Clear existing users
        await User.deleteMany({});

        // Create manager
        await User.create({
            name: 'דנה כהן',
            email: 'dana@bezeq.co.il',
            password: await bcrypt.hash('password123', 10),
            role: 'manager',
            isActive: true,
            isFixedMorning: true,
        });

        // Create employees
        await User.create({
            name: 'עמית אברהמי',
            email: 'amit@bezeq.co.il',
            password: await bcrypt.hash('password123', 10),
            role: 'employee',
            isActive: true,
            isFixedMorning: false,
        });

        console.log('✅ Test users created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
};

seedUsers();
