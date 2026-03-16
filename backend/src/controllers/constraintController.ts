import { Request, Response } from 'express';
import { AuthRequest } from '../types/express';
import { z } from 'zod';
import { Constraint } from '../models/Constraint';
import { getWeekDates } from '../utils/weekUtils';

// Define the incoming schema for validation
const constraintSchema = z.object({
    weekId: z.string().regex(/^\d{4}-W\d{2}$/, "Invalid week format"),
    constraints: z.array(z.object({
        date: z.string().or(z.date()).transform(val => new Date(val)),
        shift: z.enum(['morning', 'afternoon', 'night']),
        canWork: z.boolean()
    })).min(1, "Constraints array cannot be empty")
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
