import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { Notification } from '../models/Notification';

/**
 * GET /api/notifications  [ALL AUTHENTICATED]
 *
 * Returns all unread notifications for the requesting user, plus a total count.
 *
 * @param req - { user: { userId: string } }
 * @param res - { notifications: INotification[], unreadCount: number }
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        const notifications = await Notification.find({ userId, isRead: false })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                notifications,
                unreadCount: notifications.length,
            },
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * PATCH /api/notifications/:id/read  [ALL AUTHENTICATED]
 *
 * Marks a single notification as read.
 * Returns 403 if the notification does not belong to the requesting user,
 * preventing users from marking other users' notifications as read.
 *
 * @param req - { params: { id: string }, user: { userId: string } }
 * @param res - the updated notification document
 */
export const markAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;

        // מציאת ההתראה עם בדיקת בעלות
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'התראה לא נמצאה' });
        }

        // אבטחה: עובד לא יכול לסמן התראה של עובד אחר
        if (notification.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'אין הרשאה לסמן התראה זו' });
        }

        notification.isRead = true;
        await notification.save();

        return res.status(200).json({ success: true, data: notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
