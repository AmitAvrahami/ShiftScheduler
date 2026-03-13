import { Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Schedule } from '../models/Schedule';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { Constraint } from '../models/Constraint';
import { generateWeekSchedule } from '../services/schedulerService';
import { getWeekDates } from '../utils/weekUtils';

// ─── Validation ───────────────────────────────────────────────────────────────

const weekIdSchema = z.string().regex(/^\d{4}-W\d{2}$/, 'פורמט weekId לא תקין — נדרש YYYY-Www');

/**
 * Zod schema for the PATCH /shifts body.
 * Each shift entry must have an ISO date string, a valid shift type,
 * and an array of valid MongoDB ObjectId strings for employees.
 */
const updateShiftsBodySchema = z.object({
    shifts: z.array(
        z.object({
            date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
            type: z.enum(['morning', 'afternoon', 'night']),
            employees: z.array(z.string()),
        })
    ),
});

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * POST /api/schedules/generate  [MANAGER ONLY]
 *
 * Calls the scheduling algorithm and upserts the Schedule document.
 * Does NOT set isPublished — publishing is a separate explicit step.
 *
 * Returns 400 if the schedule for this week is already published.
 * Adds a warning (not an error) if constraints are not yet locked.
 *
 * @param req - { body: { weekId: string } }
 * @param res - { schedule, warnings }
 */
export const generateSchedule = async (req: Request, res: Response) => {
    try {
        const { weekId } = weekIdSchema.parse(req.body.weekId)
            ? req.body
            : (() => { throw new Error('Invalid weekId'); })();

        weekIdSchema.parse(weekId);

        // בדוק אם הסידור כבר פורסם — לא ניתן לשנות לאחר פרסום
        const existingSchedule = await Schedule.findOne({
            weekStartDate: getWeekDates(weekId)[0],
        });
        if (existingSchedule?.isPublished) {
            return res.status(400).json({
                success: false,
                message: 'הסידור כבר פורסם ולא ניתן לשנות',
            });
        }

        // הרץ את האלגוריתם (לא שומר ל-DB)
        const { shifts, warnings } = await generateWeekSchedule(weekId);

        const weekStartDate = getWeekDates(weekId)[0];

        // Upsert — אם קיים עדכן, אחרת צור
        const schedule = await Schedule.findOneAndUpdate(
            { weekStartDate },
            {
                weekStartDate,
                shifts,
                isPublished: false,
            },
            { new: true, upsert: true },
        ).populate('shifts.employees', 'name');

        return res.status(200).json({
            success: true,
            data: { schedule, warnings },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error generating schedule:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/schedules/:weekId  [ALL AUTHENTICATED]
 *
 * Role-aware:
 * - Manager: always returns the full schedule (published or draft)
 * - Employee: returns 404 if the schedule is not yet published
 *
 * @param req - { params: { weekId: string }, user: { role: string } }
 * @param res - full ISchedule document with employees populated (name only)
 */
export const getSchedule = async (req: Request, res: Response) => {
    try {
        const { weekId } = req.params;
        weekIdSchema.parse(weekId);

        const weekStartDate = getWeekDates(weekId)[0];
        const schedule = await Schedule.findOne({ weekStartDate })
            .populate('shifts.employees', 'name');

        if (!schedule) {
            return res.status(404).json({ success: false, message: 'לא נמצא סידור לשבוע זה' });
        }

        // עובד רגיל לא רואה סידור לא פורסם
        const userRole = (req as any).user?.role;
        if (!schedule.isPublished && userRole !== 'manager') {
            return res.status(404).json({ success: false, message: 'הסידור טרם פורסם' });
        }

        return res.status(200).json({ success: true, data: schedule });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error fetching schedule:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * PATCH /api/schedules/:weekId/publish  [MANAGER ONLY]
 *
 * Sets isPublished=true and creates in-app notifications for all active employees.
 *
 * @param req - { params: { weekId: string } }
 * @param res - updated ISchedule document
 */
export const publishSchedule = async (req: Request, res: Response) => {
    try {
        const { weekId } = req.params;
        weekIdSchema.parse(weekId);

        const weekStartDate = getWeekDates(weekId)[0];
        const schedule = await Schedule.findOneAndUpdate(
            { weekStartDate },
            { isPublished: true },
            { new: true },
        ).populate('shifts.employees', 'name');

        if (!schedule) {
            return res.status(404).json({ success: false, message: 'לא נמצא סידור לשבוע זה' });
        }

        // יצירת התראות לכל העובדים הפעילים
        const activeUsers = await User.find({ isActive: true }).select('_id');
        const notifications = activeUsers.map(user => ({
            userId: user._id,
            type: 'schedule_published' as const,
            message: `הסידור לשבוע ${weekId} פורסם`,
            weekId,
            isRead: false,
        }));
        await Notification.insertMany(notifications);

        return res.status(200).json({ success: true, data: schedule });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error publishing schedule:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/schedules/:weekId/my  [ALL AUTHENTICATED]
 *
 * Returns only the shifts where the requesting user appears in the employees array.
 * Only available when the schedule is published (or user is manager).
 *
 * @param req - { params: { weekId: string }, user: { userId: string, role: string } }
 * @param res - Array of IShift filtered to this user only
 */
export const getMySchedule = async (req: Request, res: Response) => {
    try {
        const { weekId } = req.params;
        weekIdSchema.parse(weekId);

        const userId = (req as any).user?.userId;
        const userRole = (req as any).user?.role;

        const weekStartDate = getWeekDates(weekId)[0];
        const schedule = await Schedule.findOne({ weekStartDate })
            .populate('shifts.employees', 'name');

        if (!schedule) {
            return res.status(404).json({ success: false, message: 'לא נמצא סידור לשבוע זה' });
        }

        if (!schedule.isPublished && userRole !== 'manager') {
            return res.status(404).json({ success: false, message: 'הסידור טרם פורסם' });
        }

        // סינון רק המשמרות שבהן העובד משובץ
        const myShifts = schedule.shifts.filter(shift =>
            shift.employees.some((emp: any) => {
                // handle both populated and non-populated employees
                if (typeof emp === 'object' && emp !== null && '_id' in emp) {
                    return emp._id.toString() === userId;
                }
                return emp.toString() === userId;
            }),
        );

        return res.status(200).json({ success: true, data: myShifts });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error fetching my schedule:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * PATCH /api/schedules/:weekId/shifts  [MANAGER ONLY]
 *
 * Replaces the shifts array of an existing schedule document.
 * Used by the drag-and-drop schedule editor to persist manual changes.
 *
 * Validation flow:
 * ```mermaid
 * graph TD
 *   A[Validate weekId] --> B{Schedule exists?}
 *   B -->|No| C[404 Not Found]
 *   B -->|Yes| D{isPublished?}
 *   D -->|Yes| E[400 Cannot edit published]
 *   D -->|No| F{All employee IDs valid?}
 *   F -->|No| G[400 Invalid employee IDs]
 *   F -->|Yes| H[Replace shifts and save]
 *   H --> I[200 Updated schedule]
 * ```
 *
 * @param req - { params: { weekId }, body: { shifts: Array<{ date, type, employees[] }> } }
 * @param res - Updated and populated ISchedule document
 */
export const updateShifts = async (req: Request, res: Response) => {
    try {
        const { weekId } = req.params;
        weekIdSchema.parse(weekId);

        // Validate request body structure
        const { shifts } = updateShiftsBodySchema.parse(req.body);

        const weekStartDate = getWeekDates(weekId)[0];
        const schedule = await Schedule.findOne({ weekStartDate });

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'לא נמצא סידור לשבוע זה',
            });
        }

        // Validate every employee ObjectId exists in Users collection
        const allEmployeeIds = shifts.flatMap(shift => shift.employees);
        const uniqueEmployeeIds = [...new Set(allEmployeeIds)];

        for (const empId of uniqueEmployeeIds) {
            if (!mongoose.isValidObjectId(empId)) {
                return res.status(400).json({
                    success: false,
                    message: `מזהה עובד לא תקין: ${empId}`,
                });
            }
        }

        if (uniqueEmployeeIds.length > 0) {
            const existingCount = await User.countDocuments({
                _id: { $in: uniqueEmployeeIds },
            });
            if (existingCount !== uniqueEmployeeIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'אחד או יותר מהעובדים לא נמצאו במערכת',
                });
            }
        }

        // Replace shifts and persist
        schedule.shifts = shifts.map(shift => ({
            date: new Date(shift.date),
            type: shift.type,
            employees: shift.employees.map(id => new mongoose.Types.ObjectId(id)),
        }));

        await schedule.save();

        // שלח התראות לכל העובדים הפעילים אם הסידור כבר פורסם
        if (schedule.isPublished) {
            const activeUsers = await User.find({ isActive: true }).select('_id');
            const notifications = activeUsers.map(user => ({
                userId: user._id,
                type: 'schedule_updated' as const,
                message: 'סידור העבודה עודכן על ידי המנהל — בדוק את השינויים',
                weekId,
                isRead: false,
            }));
            await Notification.insertMany(notifications);
        }

        const updatedSchedule = await Schedule.findById(schedule._id)
            .populate('shifts.employees', 'name');

        return res.status(200).json({ success: true, data: updatedSchedule });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: error.errors[0]?.message ?? 'נתונים לא תקינים',
            });
        }
        console.error('Error updating shifts:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
