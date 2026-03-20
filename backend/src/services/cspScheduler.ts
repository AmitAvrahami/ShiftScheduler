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
     * Number of afternoon→morning "8|8" sequences in the final schedule.
     * Zero means Phase A (strict) succeeded. >0 means Phase B was required
     * and some soft violations were unavoidable.
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_ORDER: Record<ShiftType, number> = { morning: 0, afternoon: 1, night: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SHIFTS_PER_WEEK = 6;

/**
 * Catastrophic penalty applied to afternoon→morning sequence assignments in
 * Phase B (relaxed mode). Must vastly exceed any fairness penalty so that
 * soft violations are chosen only when every non-violating assignment is
 * impossible.
 */
const SOFT_VIOLATION_WEIGHT = 1_000_000;

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
 * Returns true if assigning empId to a morning shift on dateKey would create
 * an afternoon→morning "8|8" sequence (employee worked afternoon the day before).
 * Afternoon ends 22:45, morning starts 06:45 — exactly 8h rest, which is
 * technically legal but physically demanding and should be a last resort.
 */
function hasSoftViolation(
    empId: string,
    dateKey: string,
    type: ShiftType,
    empSchedules: Map<string, EmpSchedule>,
    dateKeyToDate: Map<string, Date>,
): boolean {
    if (type !== 'morning') return false;
    const prev = getAdjacentDateKey(dateKey, -1, dateKeyToDate);
    return prev !== null && (empSchedules.get(empId)?.get(prev) === 'afternoon');
}

/**
 * Symmetric check: returns true if assigning empId to an afternoon shift on
 * dateKey would create an afternoon→morning "8|8" sequence because the employee
 * already has a morning shift committed on the next day.
 */
function hasReverseSoftViolation(
    empId: string,
    dateKey: string,
    type: ShiftType,
    empSchedules: Map<string, EmpSchedule>,
    dateKeyToDate: Map<string, Date>,
): boolean {
    if (type !== 'afternoon') return false;
    const next = getAdjacentDateKey(dateKey, +1, dateKeyToDate);
    return next !== null && (empSchedules.get(empId)?.get(next) === 'morning');
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
 *   2a. Rest rule (morning): no night shift the previous day
 *   2b. Rest rule (night): no morning shift already assigned the next day
 *   3a. [strictMode] afternoon→morning: no afternoon shift the previous day (8|8 pattern)
 *   3b. [strictMode] afternoon→morning (reverse): no morning shift already on the next day
 *
 * Uses dateKeyToDate for O(1) date lookup instead of O(n) weekDates.find().
 *
 * @param strictMode - When true, the afternoon→morning "8|8" soft constraint is
 *   enforced as a hard rule. Phase A uses strictMode=true to guarantee zero soft
 *   violations when staffing allows. Phase B uses strictMode=false and relies on
 *   SOFT_VIOLATION_WEIGHT in orderValues() to discourage violations instead.
 */
function isConsistent(
    empId: string,
    dateKey: string,
    type: ShiftType,
    empSchedules: Map<string, EmpSchedule>,
    dateKeyToDate: Map<string, Date>,
    strictMode: boolean,
): boolean {
    const schedule = empSchedules.get(empId);
    if (!schedule) return true;

    // 0. Weekly shift cap — never allow a 7th shift
    if (schedule.size >= MAX_SHIFTS_PER_WEEK) return false;

    // 1. Same-day double booking
    if (schedule.has(dateKey)) return false;

    // 2a. Rest rule (morning): no night shift the previous day
    if (type === 'morning') {
        const prevDayKey = getAdjacentDateKey(dateKey, -1, dateKeyToDate);
        if (prevDayKey && schedule.get(prevDayKey) === 'night') return false;
    }

    // 2b. Rest rule (night): no morning shift already assigned the next day
    if (type === 'night') {
        const nextDayKey = getAdjacentDateKey(dateKey, +1, dateKeyToDate);
        if (nextDayKey && schedule.get(nextDayKey) === 'morning') return false;
    }

    // 3a. Soft-as-hard (strict mode only): block 8|8 pattern — morning after afternoon
    if (strictMode && type === 'morning') {
        const prevDayKey = getAdjacentDateKey(dateKey, -1, dateKeyToDate);
        if (prevDayKey && schedule.get(prevDayKey) === 'afternoon') return false;
    }

    // 3b. Soft-as-hard (strict mode only): block 8|8 pattern — afternoon before committed morning
    if (strictMode && type === 'afternoon') {
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
 *   Tiebreaker:     weighted penalty = softPenalty + total + 2×night² + 1.5×weekend²
 *
 * In relaxed mode (strictMode=false), assignments that would create an afternoon→morning
 * "8|8" sequence are scored with SOFT_VIOLATION_WEIGHT (1,000,000), making them
 * chosen only when every non-violating candidate is impossible. In strict mode
 * (strictMode=true), isConsistent() already blocks such assignments, so softPenalty=0.
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
    jitter: number,
    empSchedules: Map<string, EmpSchedule>,
    dateKeyToDate: Map<string, Date>,
    strictMode: boolean,
): string[] {
    const scored = Array.from(domain).map(empId => {
        let pruned = 0;
        for (const nbrId of neighbors.get(v.id) ?? new Set<string>()) {
            if (assigned.has(nbrId)) continue;
            if (domains.get(nbrId)!.has(empId)) pruned++;
        }
        const total = assignmentCounts.get(empId) ?? 0;
        const night = nightCounts.get(empId) ?? 0;
        const weekend = weekendCounts.get(empId) ?? 0;
        const fairnessPenalty = total + 2 * Math.pow(night, 2) + 1.5 * Math.pow(weekend, 2);

        // In relaxed mode: add catastrophic penalty if this assignment creates an 8|8 pattern.
        // In strict mode: isConsistent() already blocks violators, so penalty is zero.
        let softPenalty = 0;
        if (!strictMode) {
            const wouldViolate =
                hasSoftViolation(empId, v.dateKey, v.type, empSchedules, dateKeyToDate) ||
                hasReverseSoftViolation(empId, v.dateKey, v.type, empSchedules, dateKeyToDate);
            if (wouldViolate) softPenalty = SOFT_VIOLATION_WEIGHT;
        }

        const penalty = softPenalty + fairnessPenalty + jitter * (Math.random() - 0.5);
        return { empId, pruned, penalty };
    });

    scored.sort((a, b) => a.pruned - b.pruned || a.penalty - b.penalty);
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

/** Sum of exponential penalties — lower means fairer night/weekend distribution. */
function computeTotalPenalty(
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
): number {
    const allEmps = new Set([...nightCounts.keys(), ...weekendCounts.keys()]);
    let total = 0;
    for (const empId of allEmps) {
        const night = nightCounts.get(empId) ?? 0;
        const weekend = weekendCounts.get(empId) ?? 0;
        total += 2 * night * night + 1.5 * weekend * weekend;
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
    dateKeyToDate: Map<string, Date>,
    neighbors: Map<string, Set<string>>,
    stats: { backtracks: number },
    jitter: number,
    strictMode: boolean,
): boolean {
    if (assigned.size === cspVars.length) return true;

    const v = selectVariable(cspVars, assigned, domains);
    const orderedValues = orderValues(
        v, domains.get(v.id)!, assigned, domains, neighbors,
        assignmentCounts, nightCounts, weekendCounts, jitter,
        empSchedules, dateKeyToDate, strictMode,
    );

    for (const empId of orderedValues) {
        if (!isConsistent(empId, v.dateKey, v.type, empSchedules, dateKeyToDate, strictMode)) continue;

        // Assign
        assignment.set(v.id, empId);
        assigned.add(v.id);
        empSchedules.get(empId)?.set(v.dateKey, v.type);
        const newCount = (assignmentCounts.get(empId) ?? 0) + 1;
        assignmentCounts.set(empId, newCount);
        if (v.type === 'night') nightCounts.set(empId, (nightCounts.get(empId) ?? 0) + 1);
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

        // Soft-constraint forward pruning (strict mode only):
        // Propagate afternoon→morning exclusions so wipe-out detection catches
        // dead-end paths before the recursive call, reducing backtracking.
        //   - afternoon assignment → prune empId from next-day morning vars
        // NOTE: backward pruning (morning → prev-day afternoon) is OMITTED intentionally.
        //   isConsistent() check 3b already enforces the reverse direction at assignment
        //   time; backward pruning here would cause excessive wipe-outs that make Phase A
        //   fail to find solutions that actually exist.
        // Soft-constraint forward pruning (strict mode, afternoon only):
        // When empId is assigned to an afternoon shift on day D, prune empId from all
        // unassigned morning vars on day D+1 — isConsistent check 3a would reject them
        // anyway, and early pruning enables faster wipe-out detection.
        // Backward direction (morning → prev-day afternoon) is intentionally omitted
        // to avoid false wipe-outs; isConsistent check 3b enforces that direction.
        const softRemoved = new Map<string, string[]>();
        if (strictMode && v.type === 'afternoon') {
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
            if (backtrack(cspVars, assigned, assignment, empSchedules, domains, assignmentCounts, nightCounts, weekendCounts, dateKeyToDate, neighbors, stats, jitter, strictMode)) {
                return true;
            }
        }

        // Undo
        assignment.delete(v.id);
        assigned.delete(v.id);
        empSchedules.get(empId)!.delete(v.dateKey);
        assignmentCounts.set(empId, Math.max(0, (assignmentCounts.get(empId) ?? 1) - 1));
        if (v.type === 'night') nightCounts.set(empId, Math.max(0, (nightCounts.get(empId) ?? 1) - 1));
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
 * original domain. If reassigning reduces the total exponential penalty AND
 * the new assignment passes all hard constraints, the swap is applied immediately.
 *
 * Penalty formula per employee: 2×night² + 1.5×weekend² + 0.5×total²
 *   - night/weekend terms: discourage concentration of burdensome shifts
 *   - total² term (weight 0.5): balances overall shift load across employees
 *     Fires when countA > countB + 1 (moves any shift from overloaded to underloaded)
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
            const beforeA = 2 * nightA * nightA + 1.5 * weekendA * weekendA + 0.5 * countA * countA;
            const afterNightA = isNight ? nightA - 1 : nightA;
            const afterWeekendA = isWeekend ? weekendA - 1 : weekendA;
            const afterA = 2 * afterNightA * afterNightA + 1.5 * afterWeekendA * afterWeekendA + 0.5 * (countA - 1) * (countA - 1);

            for (const empB of baselineDomains.get(v.id) ?? []) {
                if (empB === empA) continue;

                // Temporarily remove empA to test if empB is consistent
                const schedA = empSchedules.get(empA)!;
                schedA.delete(v.dateKey);
                const canWork = isConsistent(empB, v.dateKey, v.type, empSchedules, dateKeyToDate, strictMode);
                schedA.set(v.dateKey, v.type); // always restore

                if (!canWork) continue;

                const nightB = nightCounts.get(empB) ?? 0;
                const weekendB = weekendCounts.get(empB) ?? 0;
                const countB = assignmentCounts.get(empB) ?? 0;
                const beforeB = 2 * nightB * nightB + 1.5 * weekendB * weekendB + 0.5 * countB * countB;
                const afterNightB = isNight ? nightB + 1 : nightB;
                const afterWeekendB = isWeekend ? weekendB + 1 : weekendB;
                const afterB = 2 * afterNightB * afterNightB + 1.5 * afterWeekendB * afterWeekendB + 0.5 * (countB + 1) * (countB + 1);

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
 * employees (empA ↔ empB) reduces the total exponential penalty.
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
                const beforePenalty =
                    2 * nightA * nightA + 1.5 * weekendA * weekendA +
                    2 * nightB * nightB + 1.5 * weekendB * weekendB;

                const isNightV1 = v1.type === 'night';
                const isNightV2 = v2.type === 'night';
                const isWeekendV1 = v1.date.getDay() === 5 || v1.date.getDay() === 6;
                const isWeekendV2 = v2.date.getDay() === 5 || v2.date.getDay() === 6;

                // empA moves v1 → v2, empB moves v2 → v1
                const newNightA = nightA - (isNightV1 ? 1 : 0) + (isNightV2 ? 1 : 0);
                const newNightB = nightB - (isNightV2 ? 1 : 0) + (isNightV1 ? 1 : 0);
                const newWeekendA = weekendA - (isWeekendV1 ? 1 : 0) + (isWeekendV2 ? 1 : 0);
                const newWeekendB = weekendB - (isWeekendV2 ? 1 : 0) + (isWeekendV1 ? 1 : 0);
                const afterPenalty =
                    2 * newNightA * newNightA + 1.5 * newWeekendA * newWeekendA +
                    2 * newNightB * newNightB + 1.5 * newWeekendB * newWeekendB;

                if (afterPenalty >= beforePenalty) continue;

                // Test consistency: temporarily un-assign both, then check each direction
                const schedA = empSchedules.get(empA)!;
                const schedB = empSchedules.get(empB)!;
                schedA.delete(v1.dateKey);
                schedB.delete(v2.dateKey);
                const canAonV2 = isConsistent(empA, v2.dateKey, v2.type, empSchedules, dateKeyToDate, strictMode);
                const canBonV1 = isConsistent(empB, v1.dateKey, v1.type, empSchedules, dateKeyToDate, strictMode);
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

/**
 * Soft-violation elimination local search.
 *
 * Targets each afternoon→morning "8|8" assignment and tries to find a
 * replacement employee who can cover the same shift WITHOUT creating a
 * new soft violation. Hard constraints (rest rules, weekly cap, double
 * booking) are always respected via isConsistent(..., false).
 *
 * Only called in Phase B (when strict CSP could not produce a complete
 * solution). Phase A results are already violation-free by construction.
 *
 * Runs up to MAX_PASSES sweeps or until no violations remain.
 */
function softViolationElimination(
    cspVars: CSPVar[],
    assignment: Map<string, string>,
    empSchedules: Map<string, EmpSchedule>,
    assignmentCounts: Map<string, number>,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    dateKeyToDate: Map<string, Date>,
    baselineDomains: Map<string, Set<string>>,
): void {
    const MAX_PASSES = 3;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let improved = false;

        for (const v of cspVars) {
            const empA = assignment.get(v.id);
            if (!empA) continue;

            const schedA = empSchedules.get(empA)!;

            // Check whether empA's assignment on this slot is part of an 8|8 violation
            const isViolating =
                hasSoftViolation(empA, v.dateKey, v.type, empSchedules, dateKeyToDate) ||
                hasReverseSoftViolation(empA, v.dateKey, v.type, empSchedules, dateKeyToDate);
            if (!isViolating) continue;

            // Try to find a replacement in the baseline domain who avoids the violation
            for (const empB of baselineDomains.get(v.id) ?? []) {
                if (empB === empA) continue;
                if ((assignmentCounts.get(empB) ?? 0) >= MAX_SHIFTS_PER_WEEK) continue;

                // Temporarily remove empA to test consistency for empB
                schedA.delete(v.dateKey);
                const canWork = isConsistent(empB, v.dateKey, v.type, empSchedules, dateKeyToDate, false);

                // Ensure empB itself does not introduce a new soft violation
                const wouldViolate = canWork && (
                    hasSoftViolation(empB, v.dateKey, v.type, empSchedules, dateKeyToDate) ||
                    hasReverseSoftViolation(empB, v.dateKey, v.type, empSchedules, dateKeyToDate)
                );

                schedA.set(v.dateKey, v.type); // always restore before deciding

                if (!canWork || wouldViolate) continue;

                // Apply reassignment
                assignment.set(v.id, empB);
                schedA.delete(v.dateKey);
                empSchedules.get(empB)!.set(v.dateKey, v.type);
                assignmentCounts.set(empA, Math.max(0, (assignmentCounts.get(empA) ?? 1) - 1));
                assignmentCounts.set(empB, (assignmentCounts.get(empB) ?? 0) + 1);
                const isNight = v.type === 'night';
                const isWeekend = v.date.getDay() === 5 || v.date.getDay() === 6;
                if (isNight) {
                    nightCounts.set(empA, Math.max(0, (nightCounts.get(empA) ?? 1) - 1));
                    nightCounts.set(empB, (nightCounts.get(empB) ?? 0) + 1);
                }
                if (isWeekend) {
                    weekendCounts.set(empA, Math.max(0, (weekendCounts.get(empA) ?? 1) - 1));
                    weekendCounts.set(empB, (weekendCounts.get(empB) ?? 0) + 1);
                }
                improved = true;
                break;
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
    const { slots, employees, constraintMap, partialConstraintMap, weekDates } = input;

    const managers = employees.filter(e => isManagerEmployee(e));
    const regulars = employees.filter(e => !isManagerEmployee(e));

    let assignment = new Map<string, string>();
    let assignmentCounts = new Map<string, number>();
    let nightCounts = new Map<string, number>();
    let weekendCounts = new Map<string, number>();

    // empSchedules: empId → (dateKey → shiftType) — used for consistency checks
    let empSchedules = new Map<string, EmpSchedule>();
    for (const emp of employees) empSchedules.set(emp._id.toString(), new Map());

    // ── Phase 1: Pre-assign managers to morning shifts ──────────────────────
    for (const slot of slots) {
        if (slot.type !== 'morning') continue;

        const available = managers
            .filter(m => {
                const mId = m._id.toString();
                return !constraintMap[mId]?.[slot.dateKey]?.['morning']
                    && !partialConstraintMap[mId]?.[slot.dateKey]?.['morning']?.shouldBlock;
            })
            .sort((a, b) =>
                (assignmentCounts.get(a._id.toString()) ?? 0) -
                (assignmentCounts.get(b._id.toString()) ?? 0),
            );

        const slotDayOfWeek = slot.date.getDay();
        let seatIdx = 0;
        for (const mgr of available) {
            const mgrId = mgr._id.toString();
            const varId = `${slot.dateKey}_morning_${seatIdx}`;
            assignment.set(varId, mgrId);
            assignmentCounts.set(mgrId, (assignmentCounts.get(mgrId) ?? 0) + 1);
            // morning shifts are never night; track weekend for managers too
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
    const baselineEmpSchedules = deepCopyEmpSchedules(empSchedules);
    const baselineDomains = deepCopyDomains(domains);

    // ── Build lookup structures (shared across all Phase-4 runs) ─────────────
    // O(1) date lookup instead of O(7) weekDates.find() on every constraint check
    const dateKeyToDate = new Map<string, Date>(weekDates.map(d => [toDateKey(d), d]));

    // Pre-computed neighbor adjacency: varId → neighbor varIds.
    // Encodes same-day (double-booking) and bidirectional rest-rule adjacency.
    // Built once; replaces O(N) inner loops in forwardCheck and orderValues.
    const neighbors = new Map<string, Set<string>>();
    for (const v of cspVars) {
        const nbrs = new Set<string>();
        const vDate = dateKeyToDate.get(v.dateKey);
        const nextDayKey = (vDate && v.type === 'night')
            ? toDateKey(new Date(vDate.getTime() + DAY_MS))
            : null;
        const prevDayKey = (vDate && v.type === 'morning')
            ? toDateKey(new Date(vDate.getTime() - DAY_MS))
            : null;
        for (const u of cspVars) {
            if (u.id === v.id) continue;
            if (u.dateKey === v.dateKey) { nbrs.add(u.id); continue; }
            if (nextDayKey && u.type === 'morning' && u.dateKey === nextDayKey) { nbrs.add(u.id); continue; }
            if (prevDayKey && u.type === 'night' && u.dateKey === prevDayKey) { nbrs.add(u.id); continue; }
        }
        neighbors.set(v.id, nbrs);
    }

    // ── Phase 4: Two-phase backtracking search ───────────────────────────────
    //
    // PHASE A (strict): Run CSP with afternoon→morning treated as a hard
    // constraint. If any run produces a COMPLETE solution, we use the best
    // one (lowest fairness penalty) — guaranteed zero soft violations.
    //
    // PHASE B (relaxed): Only runs if Phase A found no complete solution.
    // The afternoon→morning constraint is now a catastrophic penalty in
    // orderValues() (SOFT_VIOLATION_WEIGHT=1,000,000), so violations are
    // chosen only when every non-violating candidate is impossible.
    // Results are ranked by (softViolations ASC, penalty ASC).
    // A dedicated softViolationElimination() local search pass then tries
    // to eliminate remaining violations through candidate swaps.
    const NUM_RUNS = 16;
    const JITTER_VALUES = [0, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0, 0.2, 0.4, 0.7, 1.2, 1.8, 2.5, 4.0, 5.0]; // run 0 deterministic
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
            const runEmpSchedules = deepCopyEmpSchedules(baselineEmpSchedules);
            const runDomains = deepCopyDomains(baselineDomains);
            const runAssigned = new Set<string>();
            const runStats = { backtracks: 0 };

            const solved = backtrack(
                cspVars, runAssigned, runAssignment, runEmpSchedules, runDomains,
                runAssignmentCounts, runNightCounts, runWeekendCounts,
                dateKeyToDate, neighbors, runStats, JITTER_VALUES[run],
                true, // strictMode: enforce afternoon→morning as hard constraint
            );

            totalBacktracks += runStats.backtracks;

            // Only consider runs that produced a COMPLETE solution in Phase A
            if (!solved) continue;
            phaseAHasCompleteSolution = true;

            const penalty = computeTotalPenalty(runNightCounts, runWeekendCounts);
            if (penalty < bestPenalty) {
                bestPenalty = penalty;
                assignment = runAssignment;
                assignmentCounts = runAssignmentCounts;
                nightCounts = runNightCounts;
                weekendCounts = runWeekendCounts;
                empSchedules = runEmpSchedules;
            }
        }

        if (phaseAHasCompleteSolution) {
            // Phase A succeeded — apply fairness-only local search (no soft violations to fix)
            localSearchImprovement(
                cspVars, assignment, empSchedules, assignmentCounts,
                nightCounts, weekendCounts, dateKeyToDate, baselineDomains,
                true, // strictMode: preserve absence of 8|8 violations from Phase A
            );
            swapSearchImprovement(
                cspVars, assignment, empSchedules,
                nightCounts, weekendCounts, dateKeyToDate, baselineDomains,
                true, // strictMode: preserve absence of 8|8 violations from Phase A
            );
        } else {
            // ── Phase B: relaxed runs (soft violations allowed but catastrophically penalised) ─
            // Reset to baseline before starting Phase B
            assignment = new Map(baselineAssignment);
            assignmentCounts = new Map(baselineAssignmentCounts);
            nightCounts = new Map(baselineNightCounts);
            weekendCounts = new Map(baselineWeekendCounts);
            empSchedules = deepCopyEmpSchedules(baselineEmpSchedules);
            bestPenalty = Infinity;

            for (let run = 0; run < NUM_RUNS; run++) {
                const runAssignment = new Map(baselineAssignment);
                const runAssignmentCounts = new Map(baselineAssignmentCounts);
                const runNightCounts = new Map(baselineNightCounts);
                const runWeekendCounts = new Map(baselineWeekendCounts);
                const runEmpSchedules = deepCopyEmpSchedules(baselineEmpSchedules);
                const runDomains = deepCopyDomains(baselineDomains);
                const runAssigned = new Set<string>();
                const runStats = { backtracks: 0 };

                backtrack(
                    cspVars, runAssigned, runAssignment, runEmpSchedules, runDomains,
                    runAssignmentCounts, runNightCounts, runWeekendCounts,
                    dateKeyToDate, neighbors, runStats, JITTER_VALUES[run],
                    false, // relaxed: soft violations allowed with catastrophic penalty in orderValues
                );

                totalBacktracks += runStats.backtracks;

                // Rank: fewest soft violations first, then lowest fairness penalty
                const softViolations = countSoftViolations(runEmpSchedules, dateKeyToDate);
                const penalty = computeTotalPenalty(runNightCounts, runWeekendCounts);
                const better =
                    softViolations < bestSoftViolations ||
                    (softViolations === bestSoftViolations && penalty < bestPenalty);

                if (better) {
                    bestSoftViolations = softViolations;
                    bestPenalty = penalty;
                    assignment = runAssignment;
                    assignmentCounts = runAssignmentCounts;
                    nightCounts = runNightCounts;
                    weekendCounts = runWeekendCounts;
                    empSchedules = runEmpSchedules;
                }
            }

            // Eliminate residual soft violations through candidate swaps (before fairness pass)
            softViolationElimination(
                cspVars, assignment, empSchedules, assignmentCounts,
                nightCounts, weekendCounts, dateKeyToDate, baselineDomains,
            );

            // Then optimise fairness as usual
            localSearchImprovement(
                cspVars, assignment, empSchedules, assignmentCounts,
                nightCounts, weekendCounts, dateKeyToDate, baselineDomains,
                false, // relaxed: Phase B already attempted elimination; don't re-block
            );
            swapSearchImprovement(
                cspVars, assignment, empSchedules,
                nightCounts, weekendCounts, dateKeyToDate, baselineDomains,
                false, // relaxed: Phase B already attempted elimination; don't re-block
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
                return isConsistent(empId, v.dateKey, v.type, empSchedules, dateKeyToDate, false);
            })
            .sort((a, b) =>
                (assignmentCounts.get(a._id.toString()) ?? 0) -
                (assignmentCounts.get(b._id.toString()) ?? 0),
            );

        if (candidates.length === 0) {
            continue;
        }

        const empId = candidates[0]._id.toString();
        assignment.set(v.id, empId);
        assignmentCounts.set(empId, (assignmentCounts.get(empId) ?? 0) + 1);
        if (v.type === 'night') nightCounts.set(empId, (nightCounts.get(empId) ?? 0) + 1);
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
