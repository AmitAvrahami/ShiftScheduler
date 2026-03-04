import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    role: 'manager' | 'employee';
    isActive: boolean;
    isFixedMorning: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['manager', 'employee'], default: 'employee' },
        isActive: { type: Boolean, default: true },
        isFixedMorning: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
