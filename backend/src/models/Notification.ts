import mongoose, { Document, Schema, Types } from 'mongoose';

/** Type literals for notification categories */
export type NotificationType = 'schedule_published' | 'schedule_updated' | 'schedule_deleted';

/**
 * Notification document stored in MongoDB.
 *
 * Created when a schedule is published, updated, or deleted; consumed by the notification bell UI.
 */
export interface INotification extends Document {
    userId: Types.ObjectId;
    type: NotificationType;
    message: string;
    weekId: string;
    isRead: boolean;
    createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        type: { type: String, enum: ['schedule_published', 'schedule_updated', 'schedule_deleted'], required: true },
        message: { type: String, required: true },
        weekId: { type: String, required: true },
        isRead: { type: Boolean, default: false },
    },
    {
        // Only createdAt is meaningful; updatedAt is not needed for notifications
        timestamps: { createdAt: true, updatedAt: false },
    },
);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
