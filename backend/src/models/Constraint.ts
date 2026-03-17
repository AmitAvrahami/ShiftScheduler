import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConstraint extends Document {
    userId: Types.ObjectId;
    weekId: string;
    constraints: {
        date: Date;
        shift: string; // 'morning' | 'afternoon' | 'night'
        canWork: boolean;
        availableFrom?: string | null;  // "HH:MM", only relevant when canWork=true
        availableTo?: string | null;    // "HH:MM", only relevant when canWork=true
    }[];
    submittedAt: Date;
    isLocked: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const constraintSchema = new Schema<IConstraint>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        weekId: { type: String, required: true },
        constraints: [
            {
                date: { type: Date, required: true },
                shift: { type: String, enum: ['morning', 'afternoon', 'night'], required: true },
                canWork: { type: Boolean, default: false },
                availableFrom: { type: String, default: null },
                availableTo: { type: String, default: null }
            }
        ],
        submittedAt: { type: Date, default: Date.now },
        isLocked: { type: Boolean, default: false }
    },
    { timestamps: true }
);

constraintSchema.index({ userId: 1, weekId: 1 }, { unique: true });

export const Constraint = mongoose.model<IConstraint>('Constraint', constraintSchema);
