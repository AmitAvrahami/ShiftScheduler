import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('5000'),
    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error('❌ Invalid environment variables:', parsedEnv.error.format());
    process.exit(1);
}

export const env = parsedEnv.data;
