import { Types } from 'mongoose';
import { IUser } from '../models/User';
import { IShift } from '../models/Schedule';
import { PartialImpactResult } from '../utils/shiftTimes';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type ShiftType = 'morning' | 'afternoon' | 'night';

/** userId → dateKey → shiftType → cannotWork (true = blocked) */
export type ConstraintMap = Record<string, Record<string, Record<string, boolean>>>;

/** userId → dateKey → shiftType → PartialImpactResult (shouldBlock=false only) */
export type PartialConstraintMap = Record<string, Record<string, Record<string, PartialImpactResult>>>;

export interface PartialAssignment {
    employeeId: string;
    employeeName: string;
    dateKey: string;
    shiftType: ShiftType;
    gapDescription: string;
    action: 'cover_start' | 'cover_end';
    missingMinutes: number;
}

export interface CriticalViolation {
    dateKey: string;
    shiftType: ShiftType;
    filled: number;
    required: number;
    missing: number;
    /** Set when the slot is unfilled because all eligible employees hit the 6-shift cap */
    reason?: 'capacity_limit';
}

export interface SequenceWarning {
    employeeName: string;
    employeeId: string;
    fromShift: ShiftType;
    fromDate: string;
    toShift: ShiftType;
    toDate: string;
    /** Minimum rest between the two shifts, in hours */
    restHours: number;
}

export interface FairnessWarning {
    employeeName: string;
    employeeId: string;
    /** Which workload metric is imbalanced */
    metric: 'nightShifts' | 'weekendShifts';
    employeeCount: number;
    averageCount: number;
    /** How many percent above average this employee is */
    deviationPercent: number;
}

export interface ConstraintViolationReport {
    criticalViolations: CriticalViolation[];
    /** Re-uses PartialAssignment — employees assigned despite soft time-window constraints */
    softWarnings: PartialAssignment[];
    /** Tight turnaround warnings (e.g. afternoon → next-day morning = 8h rest) */
    sequenceWarnings: SequenceWarning[];
    /** Employees with >30% more night or weekend shifts than average */
    fairnessWarnings: FairnessWarning[];
    totalViolations: number;
}

export interface ShiftSlot {
    date: Date;
    dateKey: string;
    type: ShiftType;
    requiredHeadcount: number;
}

export interface CSPInput {
    slots: ShiftSlot[];
    employees: (IUser & { _id: Types.ObjectId })[];
    constraintMap: ConstraintMap;
    partialConstraintMap: PartialConstraintMap;
    weekDates: Date[];
}

export interface CSPResult {
    /** varId → userId (all assigned seats: manager pre-assigns + regular CSP + rescue) */
    assignments: Map<string, string>;
    /** varIds of regular seats that could not be filled */
    unfilledVars: string[];
    /** Number of backtracks performed — useful for tests and logging */
    backtracks: number;
    /** Employees assigned despite a partial time-window constraint (shouldBlock=false) */
    partialAssignments: PartialAssignment[];
    /** Night shift count per employeeId — used for fairness reporting */
    nightCounts: Map<string, number>;
    /** Weekend (Fri+Sat) shift count per employeeId — used for fairness reporting */
    weekendCounts: Map<string, number>;
    /**
     * Number of afternoon→morning sequences in the final schedule.
     * Always 0 — HC-2 is now an unconditional hard constraint enforced in all phases.
     * Retained for API backward compatibility.
     */
    softViolationCount: number;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface CSPVar {
    id: string;       // "2026-03-08_morning_1"
    dateKey: string;
    date: Date;
    type: ShiftType;
    seatIndex: number;
}

/** dateKey → shiftType assigned on that day (for one employee) */
type EmpSchedule = Map<string, ShiftType>;

/** Per-employee soft-constraint context used for penalty scoring. */
interface PenaltyContext {
    totalShifts: number;
    morningCount: number;
    afternoonCount: number;
    nightCount: number;
    consecutiveNights: number;
    weekendShifts: number;
    lastShiftType: ShiftType | null;
    lastShiftDay: number | null; // day-of-week 0=Sunday
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_ORDER: Record<ShiftType, number> = { morning: 0, afternoon: 1, night: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SHIFTS_PER_WEEK = 6;
const MAX_NIGHT_SHIFTS_PER_WEEK = 2;
const MAX_WEEKEND_SHIFTS_PER_WEEK = 2;

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isManagerEmployee(emp: IUser): boolean {
    return emp.role === 'manager' || emp.isFixedMorning === true;
}

/**
 * Returns the dateKey that is `offsetDays` days from `dateKey`.
 * Requires dateKeyToDate for O(1) lookup. Returns null if base date unknown.
 */
function getAdjacentDateKey(
    dateKey: string,
    offsetDays: number,
    dateKeyToDate: Map<string, Date>,
): string | null {
    const base = dateKeyToDate.get(dateKey);
    return base ? toDateKey(new Date(base.getTime() + offsetDays * DAY_MS)) : null;
}

/**
 * Counts the total number of afternoon→morning consecutive-day sequences
 * (8|8 patterns) across all employee schedules. Used to compare runs and
 * report the final soft violation count.
 */
function countSoftViolations(
    empSchedules: Map<string, EmpSchedule>,
    dateKeyToDate: Map<string, Date>,
): number {
    let count = 0;
    for (const [, schedule] of empSchedules) {
        for (const [dateKey, type] of schedule) {
            if (type !== 'afternoon') continue;
            const next = getAdjacentDateKey(dateKey, +1, dateKeyToDate);
            if (next && schedule.get(next) === 'morning') count++;
        }
    }
    return count;
}

/**
 * Parses a varId like "2026-03-08_morning_1"
 * into { dateKey, type, seatIndex }.
 * ISO dates use hyphens so splitting on "_" is safe.
 */
function parseVarId(varId: string): { dateKey: string; type: ShiftType; seatIndex: number } {
    const idx = varId.lastIndexOf('_');
    const seatIndex = parseInt(varId.slice(idx + 1), 10);
    const rest = varId.slice(0, idx);
    const typeIdx = rest.lastIndexOf('_');
    const type = rest.slice(typeIdx + 1) as ShiftType;
    const dateKey = rest.slice(0, typeIdx);
    return { dateKey, type, seatIndex };
}

// ─── Consistency & Forward Check ──────────────────────────────────────────────

/**
 * Returns true if empId can be assigned to (dateKey, type) given current schedules.
 * Checks:
 *   0. Weekly shift cap: no 7th shift
 *   1. No double booking on the same day
 *   2a. HC-2 rest rule (morning): no night shift the previous day
 *   2b. HC-2 rest rule (night): no morning shift already assigned the next day
 *   3a. HC-2 rest rule (morning): no afternoon shift the previous day (afternoon ends 22:45,
 *       morning starts 06:45 — less than 8h rest, hard violation per PRD)
 *   3b. HC-2 rest rule (afternoon reverse): no morning shift already committed the next day
 *   4. Night shift cap: no more than MAX_NIGHT_SHIFTS_PER_WEEK nights per employee
 *   5. Weekend cap: no more than MAX_WEEKEND_SHIFTS_PER_WEEK weekend shifts per employee
 *
 * All checks are unconditional hard constraints. The `strictMode` parameter is retained
 * for call-site compatibility but no longer affects behaviour.
 *
 * Uses dateKeyToDate for O(1) date lookup instead of O(n) weekDates.find().
 */
function isConsistent(
    empId: string,
    dateKey: string,
    type: ShiftType,
    empSchedules: Map<string, EmpSchedule>,
    dateKeyToDate: Map<string, Date>,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    _strictMode: boolean,
): boolean {
    const schedule = empSchedules.get(empId);
    if (!schedule) return true;

    // 0. Weekly shift cap — never allow a 7th shift
    if (schedule.size >= MAX_SHIFTS_PER_WEEK) return false;

    // 1b. Night shift cap — no more than MAX_NIGHT_SHIFTS_PER_WEEK per week
    if (type === 'night' && (nightCounts.get(empId) ?? 0) >= MAX_NIGHT_SHIFTS_PER_WEEK) return false;

    // 1c. Weekend cap — no more than MAX_WEEKEND_SHIFTS_PER_WEEK per week
    const slotDate = dateKeyToDate.get(dateKey);
    if (slotDate) {
        const dow = slotDate.getDay();
        if ((dow === 5 || dow === 6) && (weekendCounts.get(empId) ?? 0) >= MAX_WEEKEND_SHIFTS_PER_WEEK) return false;
    }

    // 1. Same-day double booking
    if (schedule.has(dateKey)) return false;

    // 2a. HC-2: rest rule (morning) — no night shift the previous day
    if (type === 'morning') {
        const prevDayKey = getAdjacentDateKey(dateKey, -1, dateKeyToDate);
        if (prevDayKey && schedule.get(prevDayKey) === 'night') return false;
    }

    // 2b. HC-2: rest rule (night) — no morning shift already assigned the next day
    if (type === 'night') {
        const nextDayKey = getAdjacentDateKey(dateKey, +1, dateKeyToDate);
        if (nextDayKey && schedule.get(nextDayKey) === 'morning') return false;
    }

    // 3a. HC-2: rest rule (morning) — no afternoon shift the previous day
    //     Afternoon ends 22:45, morning starts 06:45 — exactly 8h, violates minimum rest.
    if (type === 'morning') {
        const prevDayKey = getAdjacentDateKey(dateKey, -1, dateKeyToDate);
        if (prevDayKey && schedule.get(prevDayKey) === 'afternoon') return false;
    }

    // 3b. HC-2: rest rule (afternoon reverse) — no morning shift already committed the next day
    if (type === 'afternoon') {
        const nextDayKey = getAdjacentDateKey(dateKey, +1, dateKeyToDate);
        if (nextDayKey && schedule.get(nextDayKey) === 'morning') return false;
    }

    return true;
}

/**
 * After assigning empId to varId, prune empId from domains of constrained
 * (neighboring) unassigned vars.
 *
 * Neighbors are pre-computed to include:
 *   - Any var on the same day        (double-booking)
 *   - Morning vars on the next day   if varId is a night shift (rest rule, forward)
 *   - Night vars on the previous day if varId is a morning shift (rest rule, reverse)
 *
 * Returns a snapshot of pruned entries for backtrack restoration.
 */
function forwardCheck(
    empId: string,
    varId: string,
    neighbors: Map<string, Set<string>>,
    assigned: Set<string>,
    domains: Map<string, Set<string>>,
): Map<string, string[]> {
    const removed = new Map<string, string[]>();

    for (const nbrId of neighbors.get(varId) ?? new Set<string>()) {
        if (assigned.has(nbrId)) continue;
        const domain = domains.get(nbrId)!;
        if (!domain.has(empId)) continue;
        removed.set(nbrId, [empId]);
        domain.delete(empId);
    }

    return removed;
}

function restoreDomains(removed: Map<string, string[]>, domains: Map<string, Set<string>>): void {
    for (const [varId, ids] of removed) {
        const domain = domains.get(varId)!;
        for (const id of ids) domain.add(id);
    }
}

// ─── Variable & Value Ordering ────────────────────────────────────────────────

/**
 * MRV: select the unassigned CSP variable with the smallest domain.
 * Tiebreak: earlier date → earlier shift type → lower seat index.
 */
function selectVariable(
    cspVars: CSPVar[],
    assigned: Set<string>,
    domains: Map<string, Set<string>>,
): CSPVar {
    let best: CSPVar | null = null;
    let bestSize = Infinity;

    for (const v of cspVars) {
        if (assigned.has(v.id)) continue;
        const size = domains.get(v.id)!.size;

        const better =
            size < bestSize ||
            (size === bestSize &&
                best !== null &&
                (v.dateKey < best.dateKey ||
                    (v.dateKey === best.dateKey && SHIFT_ORDER[v.type] < SHIFT_ORDER[best.type]) ||
                    (v.dateKey === best.dateKey && v.type === best.type && v.seatIndex < best.seatIndex)));

        if (better) {
            best = v;
            bestSize = size;
        }
    }

    return best!;
}

/**
 * LCV + penalty-based fairness ordering:
 *   Primary sort:   fewest domain entries pruned across unassigned neighbours (LCV)
 *   Tiebreaker:     fairness penalty (total shifts × 10 + nights × 20 + weekend clustering × 30)
 *
 * HC-2 (afternoon→morning) is enforced as a hard constraint by isConsistent(), so
 * violating candidates are never present in the domain when this function is called.
 *
 * Uses pre-computed neighbor adjacency for O(neighbors) LCV scoring
 * instead of scanning all CSP variables.
 */
function orderValues(
    v: CSPVar,
    domain: Set<string>,
    assigned: Set<string>,
    domains: Map<string, Set<string>>,
    neighbors: Map<string, Set<string>>,
    assignmentCounts: Map<string, number>,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    morningCounts: Map<string, number>,
    afternoonCounts: Map<string, number>,
    empSchedules: Map<string, EmpSchedule>,
    dateKeyToDate: Map<string, Date>,
    regularEmployeeCount: number,
    _strictMode: boolean,
): string[] {
    const scored = Array.from(domain).map(empId => {
        let pruned = 0;
        for (const nbrId of neighbors.get(v.id) ?? new Set<string>()) {
            if (assigned.has(nbrId)) continue;
            if (domains.get(nbrId)!.has(empId)) pruned++;
        }
        const penalty = calculateEmployeeScore(
            empId, v.type, v.dateKey,
            nightCounts, weekendCounts, assignmentCounts,
            morningCounts, afternoonCounts,
            dateKeyToDate, empSchedules, regularEmployeeCount,
        );
        return { empId, pruned, penalty };
    });

    // Primary: fewest neighbors pruned (LCV). Secondary: lowest penalty score.
    // Final tiebreaker: _id string — guarantees deterministic order.
    scored.sort((a, b) =>
        a.pruned - b.pruned ||
        a.penalty - b.penalty ||
        a.empId.localeCompare(b.empId),
    );
    return scored.map(s => s.empId);
}

// ─── Deep-Copy Helpers & Penalty Scorer ──────────────────────────────────────

function deepCopyDomains(domains: Map<string, Set<string>>): Map<string, Set<string>> {
    const copy = new Map<string, Set<string>>();
    for (const [varId, domain] of domains) copy.set(varId, new Set(domain));
    return copy;
}

function deepCopyEmpSchedules(schedules: Map<string, EmpSchedule>): Map<string, EmpSchedule> {
    const copy = new Map<string, EmpSchedule>();
    for (const [empId, schedule] of schedules) copy.set(empId, new Map(schedule));
    return copy;
}

/**
 * Builds a PenaltyContext for an employee relative to a candidate slot.
 * Computed dynamically from empSchedules — safe under non-chronological backtracking.
 */
function buildPenaltyContext(
    empId: string,
    currentDateKey: string,
    empSchedules: Map<string, EmpSchedule>,
    assignmentCounts: Map<string, number>,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    morningCounts: Map<string, number>,
    afternoonCounts: Map<string, number>,
    dateKeyToDate: Map<string, Date>,
): PenaltyContext {
    const schedule = empSchedules.get(empId);

    // Consecutive nights immediately before currentDateKey
    let consecutiveNights = 0;
    if (schedule) {
        let k = getAdjacentDateKey(currentDateKey, -1, dateKeyToDate);
        while (k && schedule.get(k) === 'night') {
            consecutiveNights++;
            k = getAdjacentDateKey(k, -1, dateKeyToDate);
        }
    }

    // Most recent shift (chronologically) before currentDateKey
    let lastShiftType: ShiftType | null = null;
    let lastShiftDay: number | null = null;
    if (schedule && schedule.size > 0) {
        let k = getAdjacentDateKey(currentDateKey, -1, dateKeyToDate);
        while (k) {
            const t = schedule.get(k);
            if (t !== undefined) {
                lastShiftType = t;
                lastShiftDay = dateKeyToDate.get(k)?.getDay() ?? null;
                break;
            }
            k = getAdjacentDateKey(k, -1, dateKeyToDate);
        }
    }

    return {
        totalShifts: assignmentCounts.get(empId) ?? 0,
        morningCount: morningCounts.get(empId) ?? 0,
        afternoonCount: afternoonCounts.get(empId) ?? 0,
        nightCount: nightCounts.get(empId) ?? 0,
        consecutiveNights,
        weekendShifts: weekendCounts.get(empId) ?? 0,
        lastShiftType,
        lastShiftDay,
    };
}

/**
 * Penalty-based candidate scoring. Lower score = better candidate.
 *
 * Rules (additive, per spec):
 *   SC-10  night → afternoon same-day finish (+100): night ends 06:45, afternoon starts 14:45
 *   SC-11  afternoon → morning next day (+100): < 8 h rest [redundant with HC-2, kept for spec]
 *   SC-12  3+ consecutive nights (+60)
 *   SC-6   shift-type count above team average (+40)
 *   SC-5   total shifts above team average (+40)
 *   SC-7   weekend slot and weekend count above team average (+40)
 *   SC-13/14 non-sequential transition: morning→night or night→morning (+20)
 */
function calculateEmployeeScore(
    empId: string,
    shiftType: ShiftType,
    currentDateKey: string,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    assignmentCounts: Map<string, number>,
    morningCounts: Map<string, number>,
    afternoonCounts: Map<string, number>,
    dateKeyToDate: Map<string, Date>,
    empSchedules: Map<string, EmpSchedule>,
    regularEmployeeCount: number,
): number {
    const ctx = buildPenaltyContext(
        empId, currentDateKey, empSchedules,
        assignmentCounts, nightCounts, weekendCounts,
        morningCounts, afternoonCounts, dateKeyToDate,
    );

    const currentDate = dateKeyToDate.get(currentDateKey);
    const isWeekendSlot = currentDate ? (currentDate.getDay() === 5 || currentDate.getDay() === 6) : false;
    const n = regularEmployeeCount || 1;

    let score = 0;

    // SC-10: night immediately before → afternoon (night ends 06:45, afternoon starts 14:45 next day)
    if (shiftType === 'afternoon') {
        const prevKey = getAdjacentDateKey(currentDateKey, -1, dateKeyToDate);
        if (prevKey && empSchedules.get(empId)?.get(prevKey) === 'night') score += 100;
    }

    // SC-11: afternoon immediately before → morning (< 8 h rest)
    if (shiftType === 'morning') {
        const prevKey = getAdjacentDateKey(currentDateKey, -1, dateKeyToDate);
        if (prevKey && empSchedules.get(empId)?.get(prevKey) === 'afternoon') score += 100;
    }

    // SC-12: already has 3+ consecutive nights → penalise another night
    if (shiftType === 'night' && ctx.consecutiveNights >= 3) score += 60;

    // SC-6: this employee's count of currentShift type > team average
    const teamNightAvg = [...nightCounts.values()].reduce((a, b) => a + b, 0) / n;
    const teamMorningAvg = [...morningCounts.values()].reduce((a, b) => a + b, 0) / n;
    const teamAfternoonAvg = [...afternoonCounts.values()].reduce((a, b) => a + b, 0) / n;
    if (shiftType === 'night' && ctx.nightCount > teamNightAvg) score += 40;
    if (shiftType === 'morning' && ctx.morningCount > teamMorningAvg) score += 40;
    if (shiftType === 'afternoon' && ctx.afternoonCount > teamAfternoonAvg) score += 40;

    // SC-5: total shifts above team average
    const teamTotalAvg = [...assignmentCounts.values()].reduce((a, b) => a + b, 0) / n;
    if (ctx.totalShifts > teamTotalAvg) score += 40;

    // SC-7: weekend slot AND above average weekend shifts
    const teamWeekendAvg = [...weekendCounts.values()].reduce((a, b) => a + b, 0) / n;
    if (isWeekendSlot && ctx.weekendShifts > teamWeekendAvg) score += 40;

    // SC-13/14: non-sequential rapid switch (morning→night or night→morning)
    if (ctx.lastShiftType !== null) {
        const lastOrder = SHIFT_ORDER[ctx.lastShiftType];
        const curOrder = SHIFT_ORDER[shiftType];
        if ((lastOrder === 0 && curOrder === 2) || (lastOrder === 2 && curOrder === 0)) score += 20;
    }

    return score;
}

/** Sum of linear penalties — lower means fairer night/weekend distribution. */
/** Sum of per-employee penalties — used to compare runs. Lower = fairer. Consistent with calculateEmployeeScore core terms. */
function computeTotalPenalty(
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    assignmentCounts: Map<string, number>,
): number {
    const allEmps = new Set([
        ...nightCounts.keys(),
        ...weekendCounts.keys(),
        ...assignmentCounts.keys(),
    ]);
    let total = 0;
    for (const empId of allEmps) {
        const night = nightCounts.get(empId) ?? 0;
        const weekend = weekendCounts.get(empId) ?? 0;
        const count = assignmentCounts.get(empId) ?? 0;
        total += count * 10 + night * 20 + (weekend > 1 ? 30 : 0);
    }
    return total;
}

// ─── Backtracking Search ──────────────────────────────────────────────────────

function backtrack(
    cspVars: CSPVar[],
    assigned: Set<string>,
    assignment: Map<string, string>,
    empSchedules: Map<string, EmpSchedule>,
    domains: Map<string, Set<string>>,
    assignmentCounts: Map<string, number>,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    morningCounts: Map<string, number>,
    afternoonCounts: Map<string, number>,
    dateKeyToDate: Map<string, Date>,
    neighbors: Map<string, Set<string>>,
    stats: { backtracks: number },
    regularEmployeeCount: number,
    strictMode: boolean,
): boolean {
    if (assigned.size === cspVars.length) return true;

    const v = selectVariable(cspVars, assigned, domains);
    const orderedValues = orderValues(
        v, domains.get(v.id)!, assigned, domains, neighbors,
        assignmentCounts, nightCounts, weekendCounts,
        morningCounts, afternoonCounts,
        empSchedules, dateKeyToDate, regularEmployeeCount, strictMode,
    );

    for (const empId of orderedValues) {
        if (!isConsistent(empId, v.dateKey, v.type, empSchedules, dateKeyToDate, nightCounts, weekendCounts, strictMode)) continue;

        // Assign
        assignment.set(v.id, empId);
        assigned.add(v.id);
        empSchedules.get(empId)?.set(v.dateKey, v.type);
        const newCount = (assignmentCounts.get(empId) ?? 0) + 1;
        assignmentCounts.set(empId, newCount);
        if (v.type === 'night') nightCounts.set(empId, (nightCounts.get(empId) ?? 0) + 1);
        if (v.type === 'morning') morningCounts.set(empId, (morningCounts.get(empId) ?? 0) + 1);
        if (v.type === 'afternoon') afternoonCounts.set(empId, (afternoonCounts.get(empId) ?? 0) + 1);
        const dayOfWeek = v.date.getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6) weekendCounts.set(empId, (weekendCounts.get(empId) ?? 0) + 1);

        // Forward check (rest rule + same-day pruning)
        const removed = forwardCheck(empId, v.id, neighbors, assigned, domains);

        // Capacity forward pruning: if employee just hit the 6-shift cap,
        // remove them from all remaining unassigned variables' domains.
        const capacityRemoved = new Map<string, string[]>();
        if (newCount >= MAX_SHIFTS_PER_WEEK) {
            for (const u of cspVars) {
                if (assigned.has(u.id)) continue;
                const uDomain = domains.get(u.id)!;
                if (!uDomain.has(empId)) continue;
                uDomain.delete(empId);
                capacityRemoved.set(u.id, [empId]);
            }
        }

        // HC-2 forward pruning (afternoon→morning, always enforced)
        const softRemoved = new Map<string, string[]>();
        if (v.type === 'afternoon') {
            const nextDayKey = getAdjacentDateKey(v.dateKey, +1, dateKeyToDate);
            if (nextDayKey) {
                for (const u of cspVars) {
                    if (assigned.has(u.id)) continue;
                    if (u.type !== 'morning' || u.dateKey !== nextDayKey) continue;
                    const uDomain = domains.get(u.id)!;
                    if (!uDomain.has(empId)) continue;
                    uDomain.delete(empId);
                    const arr = softRemoved.get(u.id) ?? [];
                    arr.push(empId);
                    softRemoved.set(u.id, arr);
                }
            }
        }

        // Check no domain is wiped
        let wiped = false;
        for (const u of cspVars) {
            if (!assigned.has(u.id) && domains.get(u.id)!.size === 0) { wiped = true; break; }
        }

        if (!wiped) {
            if (backtrack(
                cspVars, assigned, assignment, empSchedules, domains,
                assignmentCounts, nightCounts, weekendCounts, morningCounts, afternoonCounts,
                dateKeyToDate, neighbors, stats, regularEmployeeCount, strictMode,
            )) {
                return true;
            }
        }

        // Undo
        assignment.delete(v.id);
        assigned.delete(v.id);
        empSchedules.get(empId)!.delete(v.dateKey);
        assignmentCounts.set(empId, Math.max(0, (assignmentCounts.get(empId) ?? 1) - 1));
        if (v.type === 'night') nightCounts.set(empId, Math.max(0, (nightCounts.get(empId) ?? 1) - 1));
        if (v.type === 'morning') morningCounts.set(empId, Math.max(0, (morningCounts.get(empId) ?? 1) - 1));
        if (v.type === 'afternoon') afternoonCounts.set(empId, Math.max(0, (afternoonCounts.get(empId) ?? 1) - 1));
        if (dayOfWeek === 5 || dayOfWeek === 6) weekendCounts.set(empId, Math.max(0, (weekendCounts.get(empId) ?? 1) - 1));
        restoreDomains(removed, domains);
        restoreDomains(capacityRemoved, domains);
        restoreDomains(softRemoved, domains);
        stats.backtracks++;
    }

    return false;
}

// ─── Post-Hoc Local Search ────────────────────────────────────────────────────

/**
 * Single-shift reassignment local search.
 * For each assigned CSP var, tries every other eligible employee from the
 * original domain. If reassigning reduces the total linear penalty AND
 * the new assignment passes all hard constraints, the swap is applied immediately.
 *
 * Penalty formula per employee: night×20 + (weekend>1 ? 30 : 0) + total×10
 *   - night term (×20): strong penalty for night shift concentration
 *   - weekend term (30 only if >1): penalty for Friday+Saturday clustering
 *   - total term (×10): gentle load balancing across all employees
 *
 * Runs up to MAX_PASSES full sweeps or until no improving swap is found.
 */
function localSearchImprovement(
    cspVars: CSPVar[],
    assignment: Map<string, string>,
    empSchedules: Map<string, EmpSchedule>,
    assignmentCounts: Map<string, number>,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    dateKeyToDate: Map<string, Date>,
    baselineDomains: Map<string, Set<string>>,
    strictMode: boolean,
): void {
    const MAX_PASSES = 3;
    // Helper: compute per-employee penalty using linear formula
    const empPenalty = (night: number, weekend: number, count: number): number =>
        night * 20 + (weekend > 1 ? 30 : 0) + count * 10;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let improved = false;
        for (const v of cspVars) {
            const empA = assignment.get(v.id);
            if (!empA) continue;

            const isNight = v.type === 'night';
            const isWeekend = v.date.getDay() === 5 || v.date.getDay() === 6;
            const nightA = nightCounts.get(empA) ?? 0;
            const weekendA = weekendCounts.get(empA) ?? 0;
            const countA = assignmentCounts.get(empA) ?? 0;
            const beforeA = empPenalty(nightA, weekendA, countA);
            const afterNightA = isNight ? nightA - 1 : nightA;
            const afterWeekendA = isWeekend ? weekendA - 1 : weekendA;
            const afterA = empPenalty(afterNightA, afterWeekendA, countA - 1);

            for (const empB of baselineDomains.get(v.id) ?? []) {
                if (empB === empA) continue;

                // Temporarily remove empA to test if empB is consistent
                const schedA = empSchedules.get(empA)!;
                schedA.delete(v.dateKey);
                const canWork = isConsistent(empB, v.dateKey, v.type, empSchedules, dateKeyToDate, nightCounts, weekendCounts, strictMode);
                schedA.set(v.dateKey, v.type); // always restore

                if (!canWork) continue;

                const nightB = nightCounts.get(empB) ?? 0;
                const weekendB = weekendCounts.get(empB) ?? 0;
                const countB = assignmentCounts.get(empB) ?? 0;
                const beforeB = empPenalty(nightB, weekendB, countB);
                const afterNightB = isNight ? nightB + 1 : nightB;
                const afterWeekendB = isWeekend ? weekendB + 1 : weekendB;
                const afterB = empPenalty(afterNightB, afterWeekendB, countB + 1);

                if ((afterA + afterB) < (beforeA + beforeB)) {
                    // Apply reassignment
                    assignment.set(v.id, empB);
                    schedA.delete(v.dateKey);
                    empSchedules.get(empB)!.set(v.dateKey, v.type);
                    assignmentCounts.set(empA, Math.max(0, (assignmentCounts.get(empA) ?? 1) - 1));
                    assignmentCounts.set(empB, (assignmentCounts.get(empB) ?? 0) + 1);
                    if (isNight) {
                        nightCounts.set(empA, Math.max(0, nightA - 1));
                        nightCounts.set(empB, nightB + 1);
                    }
                    if (isWeekend) {
                        weekendCounts.set(empA, Math.max(0, weekendA - 1));
                        weekendCounts.set(empB, weekendB + 1);
                    }
                    improved = true;
                    break;
                }
            }
        }
        if (!improved) break;
    }
}

/**
 * Pairwise swap local search.
 * Tries all pairs of assigned vars (v1, v2) and checks if swapping their
 * employees (empA ↔ empB) reduces the total linear penalty.
 * Complements localSearchImprovement by escaping situations where a single
 * reassignment cannot improve fairness but a two-employee swap can.
 * Runs up to MAX_PASSES sweeps or until no improving swap is found.
 */
function swapSearchImprovement(
    cspVars: CSPVar[],
    assignment: Map<string, string>,
    empSchedules: Map<string, EmpSchedule>,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    dateKeyToDate: Map<string, Date>,
    baselineDomains: Map<string, Set<string>>,
    strictMode: boolean,
): void {
    const MAX_PASSES = 2;
    // Helper: compute per-employee penalty using linear formula
    // Note: for swaps, count doesn't change per employee, so pass 0 for count term
    const empPenalty = (night: number, weekend: number): number =>
        night * 20 + (weekend > 1 ? 30 : 0);

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let improved = false;
        const varList = cspVars.filter(v => assignment.has(v.id));
        for (let i = 0; i < varList.length; i++) {
            for (let j = i + 1; j < varList.length; j++) {
                const v1 = varList[i];
                const v2 = varList[j];
                const empA = assignment.get(v1.id)!;
                const empB = assignment.get(v2.id)!;
                if (empA === empB) continue;

                // Both employees must be eligible for each other's shift
                if (!baselineDomains.get(v1.id)?.has(empB)) continue;
                if (!baselineDomains.get(v2.id)?.has(empA)) continue;

                // Compute penalty before swap
                const nightA = nightCounts.get(empA) ?? 0;
                const nightB = nightCounts.get(empB) ?? 0;
                const weekendA = weekendCounts.get(empA) ?? 0;
                const weekendB = weekendCounts.get(empB) ?? 0;
                const beforePenalty = empPenalty(nightA, weekendA) + empPenalty(nightB, weekendB);

                const isNightV1 = v1.type === 'night';
                const isNightV2 = v2.type === 'night';
                const isWeekendV1 = v1.date.getDay() === 5 || v1.date.getDay() === 6;
                const isWeekendV2 = v2.date.getDay() === 5 || v2.date.getDay() === 6;

                // empA moves v1 → v2, empB moves v2 → v1
                const newNightA = nightA - (isNightV1 ? 1 : 0) + (isNightV2 ? 1 : 0);
                const newNightB = nightB - (isNightV2 ? 1 : 0) + (isNightV1 ? 1 : 0);
                const newWeekendA = weekendA - (isWeekendV1 ? 1 : 0) + (isWeekendV2 ? 1 : 0);
                const newWeekendB = weekendB - (isWeekendV2 ? 1 : 0) + (isWeekendV1 ? 1 : 0);
                const afterPenalty = empPenalty(newNightA, newWeekendA) + empPenalty(newNightB, newWeekendB);

                if (afterPenalty >= beforePenalty) continue;

                // Test consistency: temporarily un-assign both, then check each direction
                const schedA = empSchedules.get(empA)!;
                const schedB = empSchedules.get(empB)!;
                schedA.delete(v1.dateKey);
                schedB.delete(v2.dateKey);
                const canAonV2 = isConsistent(empA, v2.dateKey, v2.type, empSchedules, dateKeyToDate, nightCounts, weekendCounts, strictMode);
                const canBonV1 = isConsistent(empB, v1.dateKey, v1.type, empSchedules, dateKeyToDate, nightCounts, weekendCounts, strictMode);
                // Always restore before deciding
                schedA.set(v1.dateKey, v1.type);
                schedB.set(v2.dateKey, v2.type);

                if (!canAonV2 || !canBonV1) continue;

                // Apply swap
                assignment.set(v1.id, empB);
                assignment.set(v2.id, empA);
                schedA.delete(v1.dateKey);
                schedB.delete(v2.dateKey);
                schedA.set(v2.dateKey, v2.type);
                schedB.set(v1.dateKey, v1.type);
                nightCounts.set(empA, Math.max(0, newNightA));
                nightCounts.set(empB, Math.max(0, newNightB));
                weekendCounts.set(empA, Math.max(0, newWeekendA));
                weekendCounts.set(empB, Math.max(0, newWeekendB));
                // assignmentCounts unchanged (total shifts per employee stays the same)
                improved = true;
            }
        }
        if (!improved) break;
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Solves the weekly shift scheduling CSP.
 *
 * Phase 1 – Pre-assign all available managers/isFixedMorning employees to
 *            morning shifts (forced assignment, load-balanced).
 * Phase 2 – Build CSP variables for the remaining (regular) seats.
 * Phase 3 – Build per-variable domains (regular employees, constraint-filtered).
 * Phase 4 – Backtracking search with MRV + LCV + forward checking.
 * Phase 5 – Greedy rescue: fill any seats the backtracker couldn't cover
 *            (handles genuinely under-staffed weeks without crashing).
 */
export function solveCsp(input: CSPInput): CSPResult {
    const { slots, constraintMap, partialConstraintMap, weekDates } = input;

    // Sort employees by _id for deterministic iteration order
    const employees = [...input.employees].sort((a, b) =>
        a._id.toString().localeCompare(b._id.toString()),
    );

    const managers = employees.filter(e => isManagerEmployee(e));
    const regulars = employees.filter(e => !isManagerEmployee(e));
    const regularEmployeeCount = regulars.length;

    let assignment = new Map<string, string>();
    let assignmentCounts = new Map<string, number>();
    let nightCounts = new Map<string, number>();
    let weekendCounts = new Map<string, number>();
    let morningCounts = new Map<string, number>();
    let afternoonCounts = new Map<string, number>();

    // empSchedules: empId → (dateKey → shiftType) — used for consistency checks
    let empSchedules = new Map<string, EmpSchedule>();
    for (const emp of employees) empSchedules.set(emp._id.toString(), new Map());

    // ── Phase 1: Pre-assign managers to morning shifts ──────────────────────
    for (const slot of slots) {
        if (slot.type !== 'morning') continue;

        const available = managers
            .filter(m => {
                const mId = m._id.toString();
                // HC-1: managers/isFixedMorning are exempt from MAX_SHIFTS_PER_WEEK cap
                // because they must cover all 7 morning slots per week.
                if (constraintMap[mId]?.[slot.dateKey]?.['morning']) return false;
                if (partialConstraintMap[mId]?.[slot.dateKey]?.['morning']?.shouldBlock) return false;
                return true;
            })
            .sort((a, b) =>
                (assignmentCounts.get(a._id.toString()) ?? 0) -
                (assignmentCounts.get(b._id.toString()) ?? 0) ||
                a._id.toString().localeCompare(b._id.toString()),
            );

        const slotDayOfWeek = slot.date.getDay();
        let seatIdx = 0;
        for (const mgr of available) {
            const mgrId = mgr._id.toString();
            const varId = `${slot.dateKey}_morning_${seatIdx}`;
            assignment.set(varId, mgrId);
            assignmentCounts.set(mgrId, (assignmentCounts.get(mgrId) ?? 0) + 1);
            morningCounts.set(mgrId, (morningCounts.get(mgrId) ?? 0) + 1);
            if (slotDayOfWeek === 5 || slotDayOfWeek === 6) weekendCounts.set(mgrId, (weekendCounts.get(mgrId) ?? 0) + 1);
            empSchedules.get(mgrId)!.set(slot.dateKey, 'morning');
            seatIdx++;
        }
    }

    // ── Phase 2: Build CSP vars for remaining regular seats ─────────────────
    const cspVars: CSPVar[] = [];
    for (const slot of slots) {
        let filledByManagers = 0;
        if (slot.type === 'morning') {
            for (const [varId] of assignment) {
                const { dateKey, type } = parseVarId(varId);
                if (dateKey === slot.dateKey && type === 'morning') filledByManagers++;
            }
        }
        const regularSeatsNeeded = Math.max(0, slot.requiredHeadcount - filledByManagers);
        for (let i = 0; i < regularSeatsNeeded; i++) {
            cspVars.push({
                id: `${slot.dateKey}_${slot.type}_${filledByManagers + i}`,
                dateKey: slot.dateKey,
                date: slot.date,
                type: slot.type,
                seatIndex: filledByManagers + i,
            });
        }
    }

    // ── Phase 3: Build domains (regular employees, hard-constraint filtered) ─
    const domains = new Map<string, Set<string>>();
    for (const v of cspVars) {
        const eligible = regulars
            .filter(emp => {
                const eId = emp._id.toString();
                if (constraintMap[eId]?.[v.dateKey]?.[v.type]) return false;
                if (partialConstraintMap[eId]?.[v.dateKey]?.[v.type]?.shouldBlock) return false;
                if ((assignmentCounts.get(eId) ?? 0) >= MAX_SHIFTS_PER_WEEK) return false;
                return true;
            })
            .map(emp => emp._id.toString());
        domains.set(v.id, new Set(eligible));
    }

    // ── Baseline snapshot (post-Phase-1, pre-CSP) ────────────────────────────
    const baselineAssignment = new Map(assignment);
    const baselineAssignmentCounts = new Map(assignmentCounts);
    const baselineNightCounts = new Map(nightCounts);
    const baselineWeekendCounts = new Map(weekendCounts);
    const baselineMorningCounts = new Map(morningCounts);
    const baselineAfternoonCounts = new Map(afternoonCounts);
    const baselineEmpSchedules = deepCopyEmpSchedules(empSchedules);
    const baselineDomains = deepCopyDomains(domains);

    // ── Build lookup structures (shared across all Phase-4 runs) ─────────────
    // O(1) date lookup instead of O(7) weekDates.find() on every constraint check
    const dateKeyToDate = new Map<string, Date>(weekDates.map(d => [toDateKey(d), d]));

    // Pre-computed neighbor adjacency: varId → neighbor varIds.
    // Encodes same-day (double-booking) and bidirectional HC-2 rest-rule adjacency:
    //   - night var    → next-day morning vars   (night→morning HC-2)
    //   - morning var  → prev-day night vars      (reverse of above)
    //   - afternoon var → next-day morning vars   (afternoon→morning HC-2, now always hard)
    //   - morning var  → prev-day afternoon vars  (reverse of above)
    // Built once; replaces O(N) inner loops in forwardCheck and orderValues.
    const neighbors = new Map<string, Set<string>>();
    for (const v of cspVars) {
        const nbrs = new Set<string>();
        const vDate = dateKeyToDate.get(v.dateKey);
        // next-day key for night vars (night→morning pruning)
        const nextDayKey_night = (vDate && v.type === 'night')
            ? toDateKey(new Date(vDate.getTime() + DAY_MS))
            : null;
        // next-day key for afternoon vars (afternoon→morning HC-2 pruning)
        const nextDayKey_afternoon = (vDate && v.type === 'afternoon')
            ? toDateKey(new Date(vDate.getTime() + DAY_MS))
            : null;
        // prev-day key for morning vars (covers both night←morning and afternoon←morning)
        const prevDayKey = (vDate && v.type === 'morning')
            ? toDateKey(new Date(vDate.getTime() - DAY_MS))
            : null;
        for (const u of cspVars) {
            if (u.id === v.id) continue;
            if (u.dateKey === v.dateKey) { nbrs.add(u.id); continue; }
            if (nextDayKey_night && u.type === 'morning' && u.dateKey === nextDayKey_night) { nbrs.add(u.id); continue; }
            if (nextDayKey_afternoon && u.type === 'morning' && u.dateKey === nextDayKey_afternoon) { nbrs.add(u.id); continue; }
            if (prevDayKey && u.dateKey === prevDayKey && (u.type === 'night' || u.type === 'afternoon')) { nbrs.add(u.id); continue; }
        }
        neighbors.set(v.id, nbrs);
    }

    // ── Phase 4: Two-phase backtracking search ───────────────────────────────
    //
    // PHASE A (strict): Run CSP with all HC-2 rules enforced as hard constraints.
    // If any run produces a COMPLETE solution, use the best one (lowest fairness
    // penalty). Both phases enforce HC-2 identically — the difference is that Phase A
    // only accepts COMPLETE solutions while Phase B accepts any (partial) result.
    //
    // PHASE B (fallback): Only runs if Phase A found no complete solution.
    // Accepts partial schedules (some slots unfilled, triggering HC-3 alerts
    // for the manager). Picks the run with the lowest fairness penalty.
    const NUM_RUNS = 1; // All runs are deterministic — a single run suffices
    let bestPenalty = Infinity;
    let bestSoftViolations = Infinity;
    let totalBacktracks = 0;
    let phaseAHasCompleteSolution = false;

    if (cspVars.length > 0) {
        // ── Phase A: strict runs (soft-as-hard) ──────────────────────────────
        for (let run = 0; run < NUM_RUNS; run++) {
            const runAssignment = new Map(baselineAssignment);
            const runAssignmentCounts = new Map(baselineAssignmentCounts);
            const runNightCounts = new Map(baselineNightCounts);
            const runWeekendCounts = new Map(baselineWeekendCounts);
            const runMorningCounts = new Map(baselineMorningCounts);
            const runAfternoonCounts = new Map(baselineAfternoonCounts);
            const runEmpSchedules = deepCopyEmpSchedules(baselineEmpSchedules);
            const runDomains = deepCopyDomains(baselineDomains);
            const runAssigned = new Set<string>();
            const runStats = { backtracks: 0 };

            const solved = backtrack(
                cspVars, runAssigned, runAssignment, runEmpSchedules, runDomains,
                runAssignmentCounts, runNightCounts, runWeekendCounts,
                runMorningCounts, runAfternoonCounts,
                dateKeyToDate, neighbors, runStats, regularEmployeeCount,
                true, // strictMode
            );

            totalBacktracks += runStats.backtracks;

            // Only consider runs that produced a COMPLETE solution in Phase A
            if (!solved) continue;
            phaseAHasCompleteSolution = true;

            const penalty = computeTotalPenalty(runNightCounts, runWeekendCounts, runAssignmentCounts);
            if (penalty < bestPenalty) {
                bestPenalty = penalty;
                assignment = runAssignment;
                assignmentCounts = runAssignmentCounts;
                nightCounts = runNightCounts;
                weekendCounts = runWeekendCounts;
                morningCounts = runMorningCounts;
                afternoonCounts = runAfternoonCounts;
                empSchedules = runEmpSchedules;
            }
        }

        if (phaseAHasCompleteSolution) {
            localSearchImprovement(
                cspVars, assignment, empSchedules, assignmentCounts,
                nightCounts, weekendCounts, dateKeyToDate, baselineDomains,
                true,
            );
            swapSearchImprovement(
                cspVars, assignment, empSchedules,
                nightCounts, weekendCounts, dateKeyToDate, baselineDomains,
                true,
            );
        } else {
            // ── Phase B: relaxed runs ──────────────────────────────────────────────
            assignment = new Map(baselineAssignment);
            assignmentCounts = new Map(baselineAssignmentCounts);
            nightCounts = new Map(baselineNightCounts);
            weekendCounts = new Map(baselineWeekendCounts);
            morningCounts = new Map(baselineMorningCounts);
            afternoonCounts = new Map(baselineAfternoonCounts);
            empSchedules = deepCopyEmpSchedules(baselineEmpSchedules);
            bestPenalty = Infinity;

            for (let run = 0; run < NUM_RUNS; run++) {
                const runAssignment = new Map(baselineAssignment);
                const runAssignmentCounts = new Map(baselineAssignmentCounts);
                const runNightCounts = new Map(baselineNightCounts);
                const runWeekendCounts = new Map(baselineWeekendCounts);
                const runMorningCounts = new Map(baselineMorningCounts);
                const runAfternoonCounts = new Map(baselineAfternoonCounts);
                const runEmpSchedules = deepCopyEmpSchedules(baselineEmpSchedules);
                const runDomains = deepCopyDomains(baselineDomains);
                const runAssigned = new Set<string>();
                const runStats = { backtracks: 0 };

                backtrack(
                    cspVars, runAssigned, runAssignment, runEmpSchedules, runDomains,
                    runAssignmentCounts, runNightCounts, runWeekendCounts,
                    runMorningCounts, runAfternoonCounts,
                    dateKeyToDate, neighbors, runStats, regularEmployeeCount,
                    false,
                );

                totalBacktracks += runStats.backtracks;

                const penalty = computeTotalPenalty(runNightCounts, runWeekendCounts, runAssignmentCounts);
                const better = penalty < bestPenalty;

                if (better) {
                    bestPenalty = penalty;
                    assignment = runAssignment;
                    assignmentCounts = runAssignmentCounts;
                    nightCounts = runNightCounts;
                    weekendCounts = runWeekendCounts;
                    morningCounts = runMorningCounts;
                    afternoonCounts = runAfternoonCounts;
                    empSchedules = runEmpSchedules;
                }
            }

            // Optimise fairness on the best Phase B result
            localSearchImprovement(
                cspVars, assignment, empSchedules, assignmentCounts,
                nightCounts, weekendCounts, dateKeyToDate, baselineDomains,
                true,
            );
            swapSearchImprovement(
                cspVars, assignment, empSchedules,
                nightCounts, weekendCounts, dateKeyToDate, baselineDomains,
                true,
            );
        }
    }

    // ── Phase 5: Greedy rescue for seats backtracking couldn't fill ──────────
    for (const v of cspVars) {
        if (assignment.has(v.id)) continue;

        const candidates = regulars
            .filter(emp => {
                const empId = emp._id.toString();
                if (constraintMap[empId]?.[v.dateKey]?.[v.type]) return false;
                if (partialConstraintMap[empId]?.[v.dateKey]?.[v.type]?.shouldBlock) return false;
                if ((assignmentCounts.get(empId) ?? 0) >= MAX_SHIFTS_PER_WEEK) return false;
                return isConsistent(empId, v.dateKey, v.type, empSchedules, dateKeyToDate, new Map(), new Map(), false);
            })
            .sort((a, b) =>
                (assignmentCounts.get(a._id.toString()) ?? 0) -
                (assignmentCounts.get(b._id.toString()) ?? 0) ||
                a._id.toString().localeCompare(b._id.toString()),
            );

        if (candidates.length === 0) continue;

        const empId = candidates[0]._id.toString();
        assignment.set(v.id, empId);
        assignmentCounts.set(empId, (assignmentCounts.get(empId) ?? 0) + 1);
        if (v.type === 'night') nightCounts.set(empId, (nightCounts.get(empId) ?? 0) + 1);
        if (v.type === 'morning') morningCounts.set(empId, (morningCounts.get(empId) ?? 0) + 1);
        if (v.type === 'afternoon') afternoonCounts.set(empId, (afternoonCounts.get(empId) ?? 0) + 1);
        const rescueDayOfWeek = v.date.getDay();
        if (rescueDayOfWeek === 5 || rescueDayOfWeek === 6) weekendCounts.set(empId, (weekendCounts.get(empId) ?? 0) + 1);
        empSchedules.get(empId)!.set(v.dateKey, v.type);
    }

    const unfilledVars = cspVars.filter(v => !assignment.has(v.id)).map(v => v.id);

    // ── Collect partial assignments (employees with shouldBlock=false partial constraints) ─
    const partialAssignments: PartialAssignment[] = [];
    for (const [varId, empId] of assignment) {
        const { dateKey, type } = parseVarId(varId);
        const partial = partialConstraintMap[empId]?.[dateKey]?.[type];
        if (partial && !partial.shouldBlock) {
            const emp = employees.find(e => e._id.toString() === empId);
            partialAssignments.push({
                employeeId: empId,
                employeeName: emp?.name ?? empId,
                dateKey,
                shiftType: type,
                gapDescription: partial.gapDescription,
                action: partial.action,
                missingMinutes: partial.missingMinutes,
            });
        }
    }

    return {
        assignments: assignment,
        unfilledVars,
        backtracks: totalBacktracks,
        partialAssignments,
        nightCounts,
        weekendCounts,
        softViolationCount: countSoftViolations(empSchedules, dateKeyToDate),
    };
}

// ─── Result → IShift[] ────────────────────────────────────────────────────────

/**
 * Reconstructs 21 IShift records from a CSP result.
 * Collects all assignments whose varId matches (dateKey, type) regardless of
 * seat index — this correctly handles over-staffed morning shifts when multiple
 * managers/isFixedMorning employees all appear in the same morning slot.
 */
export function buildShiftsFromResult(
    result: CSPResult,
    slots: ShiftSlot[],
): IShift[] {
    return slots.map(slot => {
        const employees: Types.ObjectId[] = [];
        const seen = new Set<string>();

        for (const [varId, empId] of result.assignments) {
            const { dateKey, type } = parseVarId(varId);
            if (dateKey === slot.dateKey && type === slot.type && !seen.has(empId)) {
                employees.push(new Types.ObjectId(empId));
                seen.add(empId);
            }
        }

        return { date: slot.date, type: slot.type, employees };
    });
}
