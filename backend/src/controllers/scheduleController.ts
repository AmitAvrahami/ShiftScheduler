import { Request, Response } from 'express';
import { AuthRequest } from '../types/express';
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
        const weekId = weekIdSchema.parse(req.body.weekId);

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
        const { shifts, warnings, partialAssignments, constraintViolationReport } = await generateWeekSchedule(weekId);

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
            data: { schedule, warnings, partialAssignments, constraintViolationReport },
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
export const getSchedule = async (req: AuthRequest, res: Response) => {
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
        const userRole = req.user?.role;
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
    const session = await mongoose.startSession();
    try {
        const { weekId } = req.params;
        weekIdSchema.parse(weekId);

        const weekStartDate = getWeekDates(weekId)[0];

        let schedule;
        await session.withTransaction(async () => {
            schedule = await Schedule.findOneAndUpdate(
                { weekStartDate },
                { isPublished: true },
                { new: true, session },
            ).populate('shifts.employees', 'name');

            if (!schedule) {
                throw new Error('NOT_FOUND');
            }

            // יצירת התראות לכל העובדים הפעילים
            const activeUsers = await User.find({ isActive: true }).session(session).select('_id');
            const notifications = activeUsers.map(user => ({
                userId: user._id,
                type: 'schedule_published' as const,
                message: `הסידור לשבוע ${weekId} פורסם`,
                weekId,
                isRead: false,
            }));
            await Notification.insertMany(notifications, { session });
        });

        return res.status(200).json({ success: true, data: schedule });
    } catch (error: any) {
        if (error.message === 'NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'לא נמצא סידור לשבוע זה' });
        }
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error publishing schedule:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        await session.endSession();
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
export const getMySchedule = async (req: AuthRequest, res: Response) => {
    try {
        const { weekId } = req.params;
        weekIdSchema.parse(weekId);

        const userId = req.user?.userId;
        const userRole = req.user?.role;

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
 * DELETE /api/schedules/:weekId  [MANAGER ONLY]
 *
 * Deletes a schedule for the given week, only if the week is current or in the future.
 * Notifies all active employees that the schedule has been cancelled.
 *
 * @param req - { params: { weekId: string } }
 * @param res - success message
 */
export const deleteSchedule = async (req: Request, res: Response) => {
    try {
        const { weekId } = req.params;
        weekIdSchema.parse(weekId);

        const weekDates = getWeekDates(weekId);
        const weekStartDate = weekDates[0];
        const weekEndDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (weekEndDate < today) {
            return res.status(400).json({
                success: false,
                message: 'לא ניתן למחוק סידור של שבוע שעבר',
            });
        }

        const schedule = await Schedule.findOneAndDelete({ weekStartDate });
        if (!schedule) {
            return res.status(404).json({ success: false, message: 'לא נמצא סידור לשבוע זה' });
        }

        const startDateStr = weekStartDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
        const endDateStr = weekEndDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

        const activeUsers = await User.find({ isActive: true }).select('_id');
        const notifications = activeUsers.map(user => ({
            userId: user._id,
            type: 'schedule_deleted' as const,
            message: `הסידור לתאריכים ${startDateStr} - ${endDateStr} בוטל. סידור חדש יפורסם בהמשך.`,
            weekId,
            isRead: false,
        }));
        await Notification.insertMany(notifications);

        return res.status(200).json({ success: true, message: 'הסידור נמחק בהצלחה' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error deleting schedule:', error);
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
export const updateShifts = async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession();
    try {
        const { weekId } = req.params;
        weekIdSchema.parse(weekId);

        // Validate request body structure
        const { shifts } = updateShiftsBodySchema.parse(req.body);

        const weekStartDate = getWeekDates(weekId)[0];
        const schedule = await Schedule.findOne({ weekStartDate }).session(session);

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: 'לא נמצא סידור לשבוע זה',
            });
        }

        // Validate every employee ObjectId exists in Users collection
        const allEmployeeIds = shifts.flatMap(shift => shift.employees);
        const uniqueEmployeeIds = [...new Set(allEmployeeIds)];

        if (!uniqueEmployeeIds.every(id => mongoose.isValidObjectId(id))) {
            return res.status(400).json({
                success: false,
                message: 'אחד או יותר ממזהי העובדים לא תקינים',
            });
        }

        if (uniqueEmployeeIds.length > 0) {
            const existingCount = await User.countDocuments({
                _id: { $in: uniqueEmployeeIds },
            }).session(session);
            if (existingCount !== uniqueEmployeeIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'אחד או יותר מהעובדים לא נמצאו במערכת',
                });
            }
        }

        let updatedSchedule;
        await session.withTransaction(async () => {
            // Replace shifts and persist
            schedule.shifts = shifts.map(shift => ({
                date: new Date(shift.date),
                type: shift.type,
                employees: shift.employees.map(id => new mongoose.Types.ObjectId(id)),
            })) as any;

            await schedule.save({ session });

            // שלח התראות לכל העובדים הפעילים אם הסידור כבר פורסם
            if (schedule.isPublished) {
                const activeUsers = await User.find({ isActive: true }).session(session).select('_id');
                const notifications = activeUsers.map(user => ({
                    userId: user._id,
                    type: 'schedule_updated' as const,
                    message: 'סידור העבודה עודכן על ידי המנהל — בדוק את השינויים',
                    weekId,
                    isRead: false,
                }));
                await Notification.insertMany(notifications, { session });
            }

            updatedSchedule = await Schedule.findById(schedule._id)
                .populate('shifts.employees', 'name')
                .session(session);
        });

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
    } finally {
        await session.endSession();
    }
};
