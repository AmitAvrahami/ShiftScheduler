import { Types } from 'mongoose';
import { User, IUser } from '../models/User';
import { Constraint, IConstraint } from '../models/Constraint';
import { IShift } from '../models/Schedule';
import { getWeekDates } from '../utils/weekUtils';
import {
    ShiftType,
    ShiftSlot,
    ConstraintMap,
    buildShiftsFromResult,
    solveCsp,
} from './cspScheduler';

// ─── Constants ────────────────────────────────────────────────────────────────

const FRIDAY = 5;
const SATURDAY = 6;

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildConstraintMap(constraints: IConstraint[]): ConstraintMap {
    const map: ConstraintMap = {};
    for (const doc of constraints) {
        const userId = doc.userId.toString();
        if (!map[userId]) map[userId] = {};
        for (const entry of doc.constraints) {
            if (!entry.canWork) {
                const key = toDateKey(new Date(entry.date));
                if (!map[userId][key]) map[userId][key] = {};
                map[userId][key][entry.shift] = true;
            }
        }
    }
    return map;
}

function getRequiredHeadcount(dayOfWeek: number, shiftType: ShiftType): number {
    if (dayOfWeek === SATURDAY) return 1;
    if (dayOfWeek === FRIDAY) return shiftType === 'morning' ? 2 : 1;
    return shiftType === 'night' ? 1 : 2;
}

function buildShiftSlots(weekDates: Date[]): ShiftSlot[] {
    const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night'];
    const slots: ShiftSlot[] = [];
    for (const date of weekDates) {
        const dayOfWeek = date.getDay();
        for (const type of shiftTypes) {
            slots.push({
                date,
                dateKey: toDateKey(date),
                type,
                requiredHeadcount: getRequiredHeadcount(dayOfWeek, type),
            });
        }
    }
    return slots;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Generates a weekly shift schedule using a CSP algorithm with backtracking,
 * MRV variable ordering, LCV value ordering, and forward checking.
 *
 * Does NOT save to DB — the calling controller handles persistence.
 */
export async function generateWeekSchedule(
    weekId: string,
): Promise<{ shifts: IShift[]; warnings: string[] }> {
    const warnings: string[] = [];

    const activeUsers = await User.find({ isActive: true }).lean<(IUser & { _id: Types.ObjectId })[]>();
    const constraintDocs = await Constraint.find({ weekId }).lean<IConstraint[]>();

    const hasLockedConstraints = constraintDocs.some(c => c.isLocked);
    if (!hasLockedConstraints) {
        warnings.push('שים לב: האילוצים לשבוע זה טרם ננעלו');
    }

    const constraintMap = buildConstraintMap(constraintDocs);
    const weekDates = getWeekDates(weekId);
    const shiftSlots = buildShiftSlots(weekDates);

    const cspResult = solveCsp({ slots: shiftSlots, employees: activeUsers, constraintMap, weekDates });
    const assignedShifts = buildShiftsFromResult(cspResult, shiftSlots);

    // Build understaffed warnings (one per shift, deduplicated)
    const shiftLabel: Record<ShiftType, string> = { morning: 'בוקר', afternoon: 'צהריים', night: 'לילה' };

    for (const varId of cspResult.unfilledVars) {
        const lastUnderscore = varId.lastIndexOf('_');
        const withoutSeat = varId.slice(0, lastUnderscore);
        const typeIdx = withoutSeat.lastIndexOf('_');
        const shiftType = withoutSeat.slice(typeIdx + 1) as ShiftType;
        const dateKey = withoutSeat.slice(0, typeIdx);

        const slotDate = weekDates.find(d => toDateKey(d) === dateKey);
        const slot = shiftSlots.find(s => s.dateKey === dateKey && s.type === shiftType);
        if (!slotDate || !slot) continue;

        const filled =
            assignedShifts.find(s => toDateKey(s.date) === dateKey && s.type === shiftType)
                ?.employees.length ?? 0;
        const missing = slot.requiredHeadcount - filled;
        if (missing > 0) {
            const dayLabel = slotDate.toLocaleDateString('he-IL', {
                weekday: 'long',
                day: 'numeric',
                month: 'numeric',
            });
            warnings.push(
                `משמרת ${shiftLabel[shiftType]} בתאריך ${dayLabel} — ${missing} עובד חסר (${filled}/${slot.requiredHeadcount})`,
            );
        }
    }

    return { shifts: assignedShifts, warnings: [...new Set(warnings)] };
}
