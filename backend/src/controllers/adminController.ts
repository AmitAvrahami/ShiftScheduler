import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Constraint } from '../models/Constraint';
import { Schedule } from '../models/Schedule';
import { getWeekDates, getPreviousWeekId } from '../utils/weekUtils';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const weekIdSchema = z.string().regex(/^\d{4}-W\d{2}$/, 'פורמט weekId לא תקין');

const createUserSchema = z.object({
    name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים'),
    email: z.string().email('פורמט אימייל לא תקין'),
    password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
    role: z.enum(['employee', 'manager', 'admin']).default('employee'),
    isFixedMorning: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
    name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים').optional(),
    email: z.string().email('פורמט אימייל לא תקין').optional(),
    password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים').optional(),
    role: z.enum(['employee', 'manager', 'admin']).optional(),
    isFixedMorning: z.boolean().optional(),
    isActive: z.boolean().optional(),
});

const overrideConstraintSchema = z.object({
    constraints: z.array(z.object({
        date: z.string().or(z.date()).transform(val => new Date(val)),
        shift: z.enum(['morning', 'afternoon', 'night']),
        canWork: z.boolean(),
        availableFrom: z.string().regex(timeRegex).nullable().optional(),
        availableTo: z.string().regex(timeRegex).nullable().optional(),
    })).min(0),
});

// GET /api/admin/stats
export const getStats = async (_req: AuthRequest, res: Response) => {
    try {
        const [
            totalUsers,
            activeManagers,
            activeEmployees,
            totalSchedules,
            publishedSchedules,
            totalConstraints,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'manager', isActive: true }),
            User.countDocuments({ role: 'employee', isActive: true }),
            Schedule.countDocuments(),
            Schedule.countDocuments({ isPublished: true }),
            Constraint.countDocuments(),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                totalUsers,
                activeManagers,
                activeEmployees,
                totalSchedules,
                publishedSchedules,
                totalConstraints,
            },
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// GET /api/admin/users
export const getAllUsers = async (_req: AuthRequest, res: Response) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error('Error fetching all users (admin):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// POST /api/admin/users
export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        const body = createUserSchema.parse(req.body);

        const existing = await User.findOne({ email: body.email });
        if (existing) {
            return res.status(400).json({ success: false, message: 'כתובת האימייל כבר קיימת במערכת' });
        }

        const hashedPassword = await bcrypt.hash(body.password, 10);
        const user = await User.create({
            name: body.name,
            email: body.email,
            password: hashedPassword,
            role: body.role,
            isFixedMorning: body.isFixedMorning ?? false,
            isActive: body.isActive ?? true,
        });

        const userResponse = user.toObject() as unknown as Record<string, unknown>;
        delete userResponse.password;

        return res.status(201).json({ success: true, data: userResponse });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error creating user (admin):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// PATCH /api/admin/users/:id
export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'מזהה משתמש לא תקין' });
        }

        const body = updateUserSchema.parse(req.body);

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
        }

        // Prevent demoting the last admin
        if (body.role && body.role !== 'admin' && user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'לא ניתן לשנות את תפקיד מנהל-העל האחרון במערכת',
                });
            }
        }

        if (body.email && body.email !== user.email) {
            const existing = await User.findOne({ email: body.email, _id: { $ne: id } });
            if (existing) {
                return res.status(400).json({ success: false, message: 'כתובת האימייל כבר קיימת במערכת' });
            }
        }

        if (body.name !== undefined) user.name = body.name;
        if (body.email !== undefined) user.email = body.email;
        if (body.role !== undefined) user.role = body.role;
        if (body.isFixedMorning !== undefined) user.isFixedMorning = body.isFixedMorning;
        if (body.isActive !== undefined) user.isActive = body.isActive;
        if (body.password) {
            user.password = await bcrypt.hash(body.password, 10);
        }

        await user.save();

        const userResponse = user.toObject() as unknown as Record<string, unknown>;
        delete userResponse.password;

        return res.status(200).json({ success: true, data: userResponse });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error updating user (admin):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// DELETE /api/admin/users/:id  (soft by default; ?hard=true for permanent)
export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const hardDelete = req.query.hard === 'true';

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'מזהה משתמש לא תקין' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
        }

        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'לא ניתן למחוק את מנהל-העל האחרון במערכת',
                });
            }
        }

        if (hardDelete) {
            await User.findByIdAndDelete(id);
            return res.status(200).json({ success: true, message: 'המשתמש נמחק לצמיתות' });
        } else {
            user.isActive = false;
            await user.save();
            return res.status(200).json({ success: true, message: 'המשתמש בוטל בהצלחה' });
        }
    } catch (error) {
        console.error('Error deleting user (admin):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// GET /api/admin/constraints?weekId=YYYY-Www
export const getAllConstraints = async (req: AuthRequest, res: Response) => {
    try {
        if (req.query.weekId) {
            const weekId = weekIdSchema.parse(req.query.weekId as string);

            // Fetch all active employees and managers (outer join source)
            const allUsers = await User.find({ isActive: true, role: { $in: ['employee', 'manager'] } })
                .select('name email role isFixedMorning isActive')
                .sort({ name: 1 })
                .lean();

            // Fetch existing constraints for this week
            const existing = await Constraint.find({ weekId })
                .populate('userId', 'name email role isFixedMorning isActive')
                .lean();

            // Map userId string → constraint document
            const constraintMap = new Map(
                existing.map(c => [String((c.userId as any)?._id), c])
            );

            // Outer join: every active user gets a row
            const merged = allUsers.map(user => {
                return constraintMap.get(String(user._id)) ?? {
                    _id: user._id,
                    userId: user,
                    weekId,
                    constraints: [],
                    isLocked: false,
                    submittedAt: null,
                };
            });

            return res.status(200).json({ success: true, data: merged });
        }

        // No weekId provided: return all existing constraints (original behaviour)
        const constraints = await Constraint.find({})
            .populate('userId', 'name email role isFixedMorning isActive')
            .sort({ weekId: -1, createdAt: -1 })
            .lean();

        return res.status(200).json({ success: true, data: constraints });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error fetching all constraints (admin):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// PATCH /api/admin/constraints/:userId/:weekId
export const overrideConstraint = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, weekId } = req.params;

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({ success: false, message: 'מזהה משתמש לא תקין' });
        }

        weekIdSchema.parse(weekId);

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'משתמש לא נמצא' });
        }

        const { constraints } = overrideConstraintSchema.parse(req.body);

        const updated = await Constraint.findOneAndUpdate(
            { userId, weekId },
            {
                $set: {
                    constraints,
                    submittedAt: new Date(),
                    isLocked: true, // Admin overrides are immediately locked
                },
            },
            { new: true, upsert: true }
        );

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error overriding constraint (admin):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// POST /api/admin/constraints/copy-week
export const copyConstraintsFromPreviousWeek = async (req: AuthRequest, res: Response) => {
    try {
        const { fromWeekId, toWeekId } = z.object({
            fromWeekId: weekIdSchema,
            toWeekId: weekIdSchema,
        }).parse(req.body);

        // Fetch all constraints for the source week
        const sourceConstraints = await Constraint.find({ weekId: fromWeekId });

        if (sourceConstraints.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'לא נמצאו אילוצים בשבוע המקור',
                count: 0,
            });
        }

        // Get the date offset (7 days)
        const sourceWeekDates = getWeekDates(fromWeekId);
        const targetWeekDates = getWeekDates(toWeekId);
        const dateOffset = targetWeekDates[0].getTime() - sourceWeekDates[0].getTime();

        let copiedCount = 0;

        // Copy constraints for each user
        for (const sourceConstraintDoc of sourceConstraints) {
            const shiftedConstraints = sourceConstraintDoc.constraints.map(constraint => ({
                ...constraint,
                date: new Date(new Date(constraint.date).getTime() + dateOffset),
            }));

            await Constraint.findOneAndUpdate(
                { userId: sourceConstraintDoc.userId, weekId: toWeekId },
                {
                    $set: {
                        constraints: shiftedConstraints,
                        submittedAt: new Date(),
                        // Note: NOT setting isLocked: true per user preference
                    },
                },
                { new: true, upsert: true }
            );

            copiedCount++;
        }

        return res.status(200).json({
            success: true,
            message: `הועתקו אילוצים ל-${copiedCount} עובדים משבוע ${fromWeekId} לשבוע ${toWeekId}`,
            count: copiedCount,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error copying constraints (admin):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// GET /api/admin/schedules
export const getAllSchedules = async (_req: AuthRequest, res: Response) => {
    try {
        const schedules = await Schedule.find()
            .select('weekStartDate isPublished createdAt updatedAt')
            .sort({ weekStartDate: -1 });

        return res.status(200).json({ success: true, data: schedules });
    } catch (error) {
        console.error('Error fetching all schedules (admin):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// DELETE /api/admin/schedules/:weekId  (no past-week guard — admin power)
export const forceDeleteSchedule = async (req: AuthRequest, res: Response) => {
    try {
        const { weekId } = req.params;
        weekIdSchema.parse(weekId);

        const weekStartDate = getWeekDates(weekId)[0];

        const schedule = await Schedule.findOneAndDelete({ weekStartDate });
        if (!schedule) {
            return res.status(404).json({ success: false, message: 'לא נמצא סידור לשבוע זה' });
        }

        return res.status(200).json({
            success: true,
            message: `הסידור לשבוע ${weekId} נמחק בהצלחה על ידי מנהל-על`,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error force-deleting schedule (admin):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
