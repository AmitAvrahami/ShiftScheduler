import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConstraint extends Document {
    user: Types.ObjectId;
    weekStartDate: Date;
    date: Date;
    shifts: string[]; // e.g. ['morning', 'afternoon', 'night']
    reason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const constraintSchema = new Schema<IConstraint>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        weekStartDate: { type: Date, required: true },
        date: { type: Date, required: true },
        shifts: [{ type: String, enum: ['morning', 'afternoon', 'night'] }],
        reason: { type: String },
    },
    { timestamps: true }
);

export const Constraint = mongoose.model<IConstraint>('Constraint', constraintSchema);
