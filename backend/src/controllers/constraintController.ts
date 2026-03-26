import { Request, Response } from 'express';
import { AuthRequest } from '../types/express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Constraint } from '../models/Constraint';
import { User } from '../models/User';
import { getWeekDates, getPreviousWeekId } from '../utils/weekUtils';

const weekIdSchema = z.string().regex(/^\d{4}-W\d{2}$/, "Invalid week format");

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const overrideConstraintSchema = z.object({
    constraints: z.array(z.object({
        date: z.string().or(z.date()).transform(val => new Date(val)),
        shift: z.enum(['morning', 'afternoon', 'night']),
        canWork: z.boolean(),
        availableFrom: z.string().regex(timeRegex).nullable().optional(),
        availableTo:   z.string().regex(timeRegex).nullable().optional(),
    })).min(0),
});

// Define the incoming schema for validation
const constraintSchema = z.object({
    weekId: z.string().regex(/^\d{4}-W\d{2}$/, "Invalid week format"),
    constraints: z.array(z.object({
        date: z.string().or(z.date()).transform(val => new Date(val)),
        shift: z.enum(['morning', 'afternoon', 'night']),
        canWork: z.boolean(),
        availableFrom: z.string().regex(timeRegex).nullable().optional(),
        availableTo:   z.string().regex(timeRegex).nullable().optional(),
    })).min(0)
});

export const submitConstraints = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const body = constraintSchema.parse(req.body);
        const { weekId, constraints } = body;

        // Reject if the week has already passed (after Saturday end-of-day)
        const weekDates = getWeekDates(weekId);
        const saturdayEnd = new Date(weekDates[6]);
        saturdayEnd.setHours(23, 59, 59, 999);
        if (new Date() > saturdayEnd) {
            return res.status(403).json({
                success: false,
                message: 'לא ניתן להגיש אילוצים לשבוע שעבר'
            });
        }

        // Check if ANY constraints are already locked by a manager for this week
        const anyLocked = await Constraint.findOne({ weekId, isLocked: true });
        if (anyLocked) {
            return res.status(403).json({
                success: false,
                message: 'לא ניתן לשנות אילוצים לאחר נעילה'
            });
        }

        // Deduplicate by (date + shift) before saving
        const seen = new Set<string>();
        const uniqueConstraints = constraints.filter(c => {
            const key = `${c.date.toISOString().split('T')[0]}_${c.shift}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Upsert constraints
        // If doesn't exist, create. If exists, replace constraints array and set submittedAt
        const updated = await Constraint.findOneAndUpdate(
            { userId, weekId },
            {
                $set: {
                    constraints: uniqueConstraints,
                    submittedAt: new Date(),
                    isLocked: false // Reset or ensure not locked from user side
                }
            },
            { new: true, upsert: true }
        );

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: 'Invalid data format', errors: error.errors });
        }
        console.error('Error submitting constraints:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const getMyConstraints = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { weekId } = req.params;

        const constraint = await Constraint.findOne({ userId, weekId });
        if (!constraint) {
            // It's not an error to not have constraints yet, just return null or empty
            return res.status(200).json({ success: true, data: null });
        }

        return res.status(200).json({ success: true, data: constraint });
    } catch (error) {
        console.error('Error fetching my constraints:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const getWeekConstraints = async (req: Request, res: Response) => {
    try {
        const { weekId } = req.params;

        // Find all constraints for this week and populate user info
        const constraints = await Constraint.find({ weekId })
            .populate('userId', 'name email role isFixedMorning isActive');

        return res.status(200).json({ success: true, data: constraints });
    } catch (error) {
        console.error('Error fetching week constraints:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const lockConstraints = async (req: Request, res: Response) => {
    try {
        const { weekId } = req.params;

        const result = await Constraint.updateMany(
            { weekId },
            { $set: { isLocked: true } }
        );

        return res.status(200).json({
            success: true,
            message: 'האילוצים ננעלו',
            lockedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error locking constraints:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const unlockConstraints = async (req: Request, res: Response) => {
    try {
        const { weekId } = req.params;

        const result = await Constraint.updateMany(
            { weekId },
            { $set: { isLocked: false } }
        );

        return res.status(200).json({
            success: true,
            message: 'הנעילה הוסרה',
            unlockedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error unlocking constraints:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const copyWeekConstraints = async (req: Request, res: Response) => {
    try {
        const { fromWeekId, toWeekId } = z.object({
            fromWeekId: weekIdSchema,
            toWeekId: weekIdSchema,
        }).parse(req.body);

        const sourceConstraints = await Constraint.find({ weekId: fromWeekId }).lean();

        if (sourceConstraints.length === 0) {
            return res.status(200).json({ success: true, message: 'לא נמצאו אילוצים בשבוע המקור', count: 0 });
        }

        const sourceWeekDates = getWeekDates(fromWeekId);
        const targetWeekDates = getWeekDates(toWeekId);
        const dateOffset = targetWeekDates[0].getTime() - sourceWeekDates[0].getTime();

        let copiedCount = 0;
        for (const sourceDoc of sourceConstraints) {
            const shiftedConstraints = sourceDoc.constraints.map(constraint => ({
                date: new Date(new Date(constraint.date).getTime() + dateOffset),
                shift: constraint.shift,
                canWork: constraint.canWork,
                availableFrom: constraint.availableFrom ?? null,
                availableTo: constraint.availableTo ?? null,
            }));

            await Constraint.findOneAndUpdate(
                { userId: sourceDoc.userId, weekId: toWeekId },
                { $set: { constraints: shiftedConstraints, submittedAt: new Date() } },
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
        console.error('Error copying constraints:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const overrideConstraintByManager = async (req: AuthRequest, res: Response) => {
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
        if (targetUser.role === 'admin') {
            return res.status(403).json({ success: false, message: 'לא ניתן לעקוף אילוצים של מנהל' });
        }

        const { constraints } = overrideConstraintSchema.parse(req.body);

        const updated = await Constraint.findOneAndUpdate(
            { userId, weekId },
            {
                $set: {
                    constraints,
                    submittedAt: new Date(),
                    isLocked: true,
                },
            },
            { new: true, upsert: true }
        );

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.errors[0]?.message });
        }
        console.error('Error overriding constraint (manager):', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
