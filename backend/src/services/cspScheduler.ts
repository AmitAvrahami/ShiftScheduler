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
 *   1. No double booking on the same day
 *   2a. Rest rule (morning): no night shift the previous day
 *   2b. Rest rule (night): no morning shift already assigned the next day
 */
function isConsistent(
    empId: string,
    dateKey: string,
    type: ShiftType,
    empSchedules: Map<string, EmpSchedule>,
    weekDates: Date[],
): boolean {
    const schedule = empSchedules.get(empId);
    if (!schedule) return true;

    // 1. Same-day double booking
    if (schedule.has(dateKey)) return false;

    // 2a. Rest rule (morning): no night shift the previous day
    if (type === 'morning') {
        const targetDate = weekDates.find(d => toDateKey(d) === dateKey);
        if (targetDate) {
            const prevDayKey = toDateKey(new Date(targetDate.getTime() - DAY_MS));
            if (schedule.get(prevDayKey) === 'night') return false;
        }
    }

    // 2b. Rest rule (night): no morning shift already assigned the next day
    if (type === 'night') {
        const targetDate = weekDates.find(d => toDateKey(d) === dateKey);
        if (targetDate) {
            const nextDayKey = toDateKey(new Date(targetDate.getTime() + DAY_MS));
            if (schedule.get(nextDayKey) === 'morning') return false;
        }
    }

    return true;
}

/**
 * After assigning empId to (dateKey, type), prune empId from domains of
 * affected unassigned vars:
 *   - Any var on the same day  (double-booking)
 *   - Morning vars on the next day if type=night  (rest rule, forward)
 *   - Night vars on the previous day if type=morning  (rest rule, reverse)
 *
 * Returns a snapshot of pruned entries for backtrack restoration.
 */
function forwardCheck(
    empId: string,
    dateKey: string,
    type: ShiftType,
    cspVars: CSPVar[],
    assigned: Set<string>,
    domains: Map<string, Set<string>>,
    weekDates: Date[],
): Map<string, string[]> {
    const removed = new Map<string, string[]>();

    for (const v of cspVars) {
        if (assigned.has(v.id)) continue;
        const domain = domains.get(v.id)!;
        if (!domain.has(empId)) continue;

        let shouldPrune = false;

        if (v.dateKey === dateKey) shouldPrune = true;

        // Night assigned → prune morning seats on the next day (forward direction)
        if (!shouldPrune && type === 'night' && v.type === 'morning') {
            const nightDate = weekDates.find(d => toDateKey(d) === dateKey);
            if (nightDate) {
                const nextDayKey = toDateKey(new Date(nightDate.getTime() + DAY_MS));
                if (v.dateKey === nextDayKey) shouldPrune = true;
            }
        }

        // Morning assigned → prune night seats on the previous day (reverse direction)
        if (!shouldPrune && type === 'morning' && v.type === 'night') {
            const morningDate = weekDates.find(d => toDateKey(d) === dateKey);
            if (morningDate) {
                const prevDayKey = toDateKey(new Date(morningDate.getTime() - DAY_MS));
                if (v.dateKey === prevDayKey) shouldPrune = true;
            }
        }

        if (shouldPrune) {
            removed.set(v.id, [empId]);
            domain.delete(empId);
        }
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
 *   Tiebreaker:     weighted penalty = total + 2×night + 1.5×weekend
 *                   (night and weekend shifts are more burdensome, so employees
 *                    who already carry more of them are deprioritised)
 */
function orderValues(
    v: CSPVar,
    domain: Set<string>,
    cspVars: CSPVar[],
    assigned: Set<string>,
    domains: Map<string, Set<string>>,
    weekDates: Date[],
    assignmentCounts: Map<string, number>,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    jitter: number,
): string[] {
    const scored = Array.from(domain).map(empId => {
        let pruned = 0;
        for (const u of cspVars) {
            if (assigned.has(u.id) || u.id === v.id) continue;
            if (!domains.get(u.id)!.has(empId)) continue;

            if (u.dateKey === v.dateKey) { pruned++; continue; }

            // Night assigned → morning next day is pruned
            if (v.type === 'night' && u.type === 'morning') {
                const nightDate = weekDates.find(d => toDateKey(d) === v.dateKey);
                if (nightDate) {
                    const nextDayKey = toDateKey(new Date(nightDate.getTime() + DAY_MS));
                    if (u.dateKey === nextDayKey) pruned++;
                }
            }

            // Morning assigned → night previous day is pruned
            if (v.type === 'morning' && u.type === 'night') {
                const morningDate = weekDates.find(d => toDateKey(d) === v.dateKey);
                if (morningDate) {
                    const prevDayKey = toDateKey(new Date(morningDate.getTime() - DAY_MS));
                    if (u.dateKey === prevDayKey) pruned++;
                }
            }
        }
        const total = assignmentCounts.get(empId) ?? 0;
        const night = nightCounts.get(empId) ?? 0;
        const weekend = weekendCounts.get(empId) ?? 0;
        const penalty = total + 2 * Math.pow(night, 2) + 1.5 * Math.pow(weekend, 2) + jitter * (Math.random() - 0.5);
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
    weekDates: Date[],
    stats: { backtracks: number },
    jitter: number,
): boolean {
    if (assigned.size === cspVars.length) return true;

    const v = selectVariable(cspVars, assigned, domains);
    const orderedValues = orderValues(
        v, domains.get(v.id)!, cspVars, assigned, domains, weekDates,
        assignmentCounts, nightCounts, weekendCounts, jitter,
    );

    for (const empId of orderedValues) {
        if (!isConsistent(empId, v.dateKey, v.type, empSchedules, weekDates)) continue;

        // Assign
        assignment.set(v.id, empId);
        assigned.add(v.id);
        empSchedules.get(empId)?.set(v.dateKey, v.type);
        assignmentCounts.set(empId, (assignmentCounts.get(empId) ?? 0) + 1);
        if (v.type === 'night') nightCounts.set(empId, (nightCounts.get(empId) ?? 0) + 1);
        const dayOfWeek = v.date.getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6) weekendCounts.set(empId, (weekendCounts.get(empId) ?? 0) + 1);

        // Forward check
        const removed = forwardCheck(empId, v.dateKey, v.type, cspVars, assigned, domains, weekDates);

        // Check no domain is wiped
        let wiped = false;
        for (const u of cspVars) {
            if (!assigned.has(u.id) && domains.get(u.id)!.size === 0) { wiped = true; break; }
        }

        if (!wiped) {
            if (backtrack(cspVars, assigned, assignment, empSchedules, domains, assignmentCounts, nightCounts, weekendCounts, weekDates, stats, jitter)) {
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
        stats.backtracks++;
    }

    return false;
}

// ─── Post-Hoc Local Search ────────────────────────────────────────────────────

/**
 * Single-shift reassignment local search.
 * For each assigned CSP var, tries every other eligible employee from the
 * original domain. If reassigning reduces the total exponential penalty
 * (i.e. improves night/weekend fairness) AND the new assignment passes
 * all hard constraints, the swap is applied immediately.
 * Runs up to MAX_PASSES full sweeps or until no improving swap is found.
 */
function localSearchImprovement(
    cspVars: CSPVar[],
    assignment: Map<string, string>,
    empSchedules: Map<string, EmpSchedule>,
    assignmentCounts: Map<string, number>,
    nightCounts: Map<string, number>,
    weekendCounts: Map<string, number>,
    weekDates: Date[],
    baselineDomains: Map<string, Set<string>>,
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
            const beforeA = 2 * nightA * nightA + 1.5 * weekendA * weekendA;
            const afterNightA = isNight ? nightA - 1 : nightA;
            const afterWeekendA = isWeekend ? weekendA - 1 : weekendA;
            const afterA = 2 * afterNightA * afterNightA + 1.5 * afterWeekendA * afterWeekendA;

            for (const empB of baselineDomains.get(v.id) ?? []) {
                if (empB === empA) continue;

                // Temporarily remove empA to test if empB is consistent
                const schedA = empSchedules.get(empA)!;
                schedA.delete(v.dateKey);
                const canWork = isConsistent(empB, v.dateKey, v.type, empSchedules, weekDates);
                schedA.set(v.dateKey, v.type); // always restore

                if (!canWork) continue;

                const nightB = nightCounts.get(empB) ?? 0;
                const weekendB = weekendCounts.get(empB) ?? 0;
                const beforeB = 2 * nightB * nightB + 1.5 * weekendB * weekendB;
                const afterNightB = isNight ? nightB + 1 : nightB;
                const afterWeekendB = isWeekend ? weekendB + 1 : weekendB;
                const afterB = 2 * afterNightB * afterNightB + 1.5 * afterWeekendB * afterWeekendB;

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
                return !constraintMap[eId]?.[v.dateKey]?.[v.type]
                    && !partialConstraintMap[eId]?.[v.dateKey]?.[v.type]?.shouldBlock;
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

    // ── Phase 4: Multi-run backtracking — pick result with lowest penalty ────
    const NUM_RUNS = 5;
    const JITTER_VALUES = [0, 0.5, 0.5, 1.0, 1.0]; // run 0 deterministic
    let bestPenalty = Infinity;
    let totalBacktracks = 0;

    if (cspVars.length > 0) {
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
                weekDates, runStats, JITTER_VALUES[run],
            );

            totalBacktracks += runStats.backtracks;

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

        localSearchImprovement(
            cspVars, assignment, empSchedules, assignmentCounts,
            nightCounts, weekendCounts, weekDates, baselineDomains,
        );
    }

    // ── Phase 5: Greedy rescue for seats backtracking couldn't fill ──────────
    for (const v of cspVars) {
        if (assignment.has(v.id)) continue;

        const candidates = regulars
            .filter(emp => {
                const empId = emp._id.toString();
                if (constraintMap[empId]?.[v.dateKey]?.[v.type]) return false;
                if (partialConstraintMap[empId]?.[v.dateKey]?.[v.type]?.shouldBlock) return false;
                return isConsistent(empId, v.dateKey, v.type, empSchedules, weekDates);
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

    return { assignments: assignment, unfilledVars, backtracks: totalBacktracks, partialAssignments, nightCounts, weekendCounts };
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
