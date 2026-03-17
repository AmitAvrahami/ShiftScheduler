import { Types } from 'mongoose';
import { User, IUser } from '../models/User';
import { Constraint, IConstraint } from '../models/Constraint';
import { IShift } from '../models/Schedule';
import { getWeekDates } from '../utils/weekUtils';
import {
    ShiftType,
    ShiftSlot,
    ConstraintMap,
    PartialConstraintMap,
    PartialAssignment,
    CriticalViolation,
    SequenceWarning,
    FairnessWarning,
    ConstraintViolationReport,
    buildShiftsFromResult,
    solveCsp,
} from './cspScheduler';
import { calculatePartialImpact } from '../utils/shiftTimes';

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
            const key = toDateKey(new Date(entry.date));
            if (!entry.canWork) {
                // Hard block: canWork=false
                if (!map[userId][key]) map[userId][key] = {};
                map[userId][key][entry.shift] = true;
            } else if (entry.availableFrom || entry.availableTo) {
                // Partial constraint where gap >= 50% also hard-blocks
                const impact = calculatePartialImpact(
                    entry.shift as ShiftType,
                    entry.availableFrom,
                    entry.availableTo,
                );
                if (impact?.shouldBlock) {
                    if (!map[userId][key]) map[userId][key] = {};
                    map[userId][key][entry.shift] = true;
                }
            }
        }
    }
    return map;
}

function buildPartialConstraintMap(constraints: IConstraint[]): PartialConstraintMap {
    const map: PartialConstraintMap = {};
    for (const doc of constraints) {
        const userId = doc.userId.toString();
        for (const entry of doc.constraints) {
            if (!entry.canWork) continue;
            if (!entry.availableFrom && !entry.availableTo) continue;
            const impact = calculatePartialImpact(
                entry.shift as ShiftType,
                entry.availableFrom,
                entry.availableTo,
            );
            if (!impact || impact.shouldBlock) continue;
            const key = toDateKey(new Date(entry.date));
            if (!map[userId]) map[userId] = {};
            if (!map[userId][key]) map[userId][key] = {};
            map[userId][key][entry.shift] = impact;
        }
    }
    return map;
}

function computeFairnessWarnings(
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    activeUsers: (IUser & { _id: Types.ObjectId })[],
): FairnessWarning[] {
    const warnings: FairnessWarning[] = [];
    const THRESHOLD = 1.3;

    function checkMetric(
        counts: Map<string, number>,
        metric: 'nightShifts' | 'weekendShifts',
    ) {
        const entries = Array.from(counts.entries()).filter(([, v]) => v > 0);
        if (entries.length === 0) return;
        const total = entries.reduce((sum, [, v]) => sum + v, 0);
        const avg = total / entries.length;
        if (avg === 0) return;
        for (const [empId, count] of entries) {
            if (count > avg * THRESHOLD) {
                const user = activeUsers.find(u => u._id.toString() === empId);
                warnings.push({
                    employeeName: user?.name ?? empId,
                    employeeId: empId,
                    metric,
                    employeeCount: count,
                    averageCount: avg,
                    deviationPercent: ((count - avg) / avg) * 100,
                });
            }
        }
    }

    checkMetric(nightCounts, 'nightShifts');
    checkMetric(weekendCounts, 'weekendShifts');
    return warnings;
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
): Promise<{ shifts: IShift[]; warnings: string[]; partialAssignments: PartialAssignment[]; constraintViolationReport: ConstraintViolationReport }> {
    const warnings: string[] = [];

    const activeUsers = await User.find({ isActive: true, role: { $ne: 'admin' } }).lean<(IUser & { _id: Types.ObjectId })[]>();
    const constraintDocs = await Constraint.find({ weekId }).lean<IConstraint[]>();

    const hasLockedConstraints = constraintDocs.some(c => c.isLocked);
    if (!hasLockedConstraints) {
        warnings.push('שים לב: האילוצים לשבוע זה טרם ננעלו');
    }

    const constraintMap = buildConstraintMap(constraintDocs);
    const partialConstraintMap = buildPartialConstraintMap(constraintDocs);
    const weekDates = getWeekDates(weekId);
    const shiftSlots = buildShiftSlots(weekDates);

    const cspResult = solveCsp({ slots: shiftSlots, employees: activeUsers, constraintMap, partialConstraintMap, weekDates });
    const assignedShifts = buildShiftsFromResult(cspResult, shiftSlots);

    // ── Build ConstraintViolationReport ───────────────────────────────────────
    const unfilledByShift = new Map<string, boolean>();
    for (const varId of cspResult.unfilledVars) {
        const key = varId.slice(0, varId.lastIndexOf('_'));
        unfilledByShift.set(key, true);
    }

    const criticalViolations: CriticalViolation[] = [];
    for (const [shiftKey] of unfilledByShift) {
        const typeIdx = shiftKey.lastIndexOf('_');
        const dateKey = shiftKey.slice(0, typeIdx);
        const shiftType = shiftKey.slice(typeIdx + 1) as ShiftType;
        const slot = shiftSlots.find(s => s.dateKey === dateKey && s.type === shiftType);
        if (!slot) continue;
        const filled =
            assignedShifts.find(s => toDateKey(s.date) === dateKey && s.type === shiftType)
                ?.employees.length ?? 0;
        const missing = slot.requiredHeadcount - filled;
        if (missing > 0) {
            criticalViolations.push({ dateKey, shiftType, filled, required: slot.requiredHeadcount, missing });
        }
    }

    // ── Detect tight-turnaround sequence warnings ────────────────────────────
    // Afternoon shift ends at 22:45 → next-day morning starts at 06:45 = exactly 8h rest.
    // While technically meeting the 8h minimum, this is a physically demanding pattern
    // that managers should be aware of.
    const sequenceWarnings: SequenceWarning[] = [];
    const employeeAssignmentMap = new Map<string, { dateKey: string; type: ShiftType }[]>();
    for (const shift of assignedShifts) {
        for (const empId of shift.employees) {
            const key = empId.toString();
            if (!employeeAssignmentMap.has(key)) employeeAssignmentMap.set(key, []);
            employeeAssignmentMap.get(key)!.push({ dateKey: toDateKey(shift.date), type: shift.type });
        }
    }
    for (const [empId, assignments] of employeeAssignmentMap) {
        for (const currentAssignment of assignments) {
            if (currentAssignment.type !== 'afternoon') continue;
            // Compute next day's dateKey
            const currentDate = weekDates.find(d => toDateKey(d) === currentAssignment.dateKey);
            if (!currentDate) continue;
            const nextDayKey = toDateKey(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000));
            const hasNextMorning = assignments.some(
                otherAssignment => otherAssignment.dateKey === nextDayKey && otherAssignment.type === 'morning',
            );
            if (hasNextMorning) {
                const employee = activeUsers.find(u => u._id.toString() === empId);
                sequenceWarnings.push({
                    employeeName: employee?.name ?? empId,
                    employeeId: empId,
                    fromShift: 'afternoon',
                    fromDate: currentAssignment.dateKey,
                    toShift: 'morning',
                    toDate: nextDayKey,
                    restHours: 8,
                });
            }
        }
    }

    const fairnessWarnings = computeFairnessWarnings(cspResult.nightCounts, cspResult.weekendCounts, activeUsers);

    const constraintViolationReport: ConstraintViolationReport = {
        criticalViolations,
        softWarnings: cspResult.partialAssignments,
        sequenceWarnings,
        fairnessWarnings,
        totalViolations: criticalViolations.length + cspResult.partialAssignments.length + sequenceWarnings.length + fairnessWarnings.length,
    };

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

    return { shifts: assignedShifts, warnings: [...new Set(warnings)], partialAssignments: cspResult.partialAssignments, constraintViolationReport };
}
