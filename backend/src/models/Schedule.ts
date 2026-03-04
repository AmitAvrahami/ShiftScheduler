import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IShift {
    date: Date;
    type: 'morning' | 'afternoon' | 'night';
    employees: Types.ObjectId[];
}

export interface ISchedule extends Document {
    weekStartDate: Date;
    shifts: IShift[];
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const shiftSchema = new Schema<IShift>({
    date: { type: Date, required: true },
    type: { type: String, enum: ['morning', 'afternoon', 'night'], required: true },
    employees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
});

const scheduleSchema = new Schema<ISchedule>(
    {
        weekStartDate: { type: Date, required: true, unique: true },
        shifts: [shiftSchema],
        isPublished: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const Schedule = mongoose.model<ISchedule>('Schedule', scheduleSchema);
