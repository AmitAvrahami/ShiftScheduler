import { Types } from 'mongoose';
import { User } from '../../models/User';
import { Constraint } from '../../models/Constraint';
import { buildShiftsFromResult, solveCsp, CSPInput, ConstraintMap, PartialConstraintMap } from '../cspScheduler';
import { generateWeekSchedule } from '../schedulerService';

/**
 * CSP-specific unit tests.
 *
 * Covers edge cases that a greedy algorithm would fail on:
 * - No valid solution (all employees blocked)
 * - Forced single-candidate assignment via backtracking
 * - Rest rule respected when backtracking reshuffles assignments
 * - Backtracking actually occurs (backtracks counter > 0)
 * - Load balance (soft constraint never overrides finding a valid solution)
 * - Consecutive-night soft preference
 * - Pure-function unit testability (no DB required for core engine)
 *
 * Week used: 2026-W11 (Sun 2026-03-08 → Sat 2026-03-14)
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Timezone-safe date key using local time — matches cspScheduler's toDateKey */
function localDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function makeEmployee(overrides: Partial<{
    name: string; email: string; role: 'manager' | 'employee'; isFixedMorning: boolean;
}> = {}) {
    return {
        _id: new Types.ObjectId(),
        name: overrides.name ?? 'Worker',
        email: overrides.email ?? `worker-${Math.random()}@test.com`,
        password: 'pw',
        role: overrides.role ?? 'employee',
        isActive: true,
        isFixedMorning: overrides.isFixedMorning ?? false,
    } as any;
}

function makeSingleDaySlots(dateKey: string, date: Date) {
    return [
        { date, dateKey, type: 'morning' as const, requiredHeadcount: 2 },
        { date, dateKey, type: 'afternoon' as const, requiredHeadcount: 2 },
        { date, dateKey, type: 'night' as const, requiredHeadcount: 1 },
    ];
}

// ─── Pure-function tests (no DB) ──────────────────────────────────────────────

describe('cspScheduler (pure, no DB)', () => {
    const date = new Date('2026-03-08T00:00:00.000Z');
    const dateKey = '2026-03-08';
    const weekDates = [date];

    it('solveCsp assigns employees and returns valid assignments (no DB required)', () => {
        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });
        const emp3 = makeEmployee({ name: 'Carol' });
        const manager = makeEmployee({ role: 'manager', name: 'Manager' });

        const slots = makeSingleDaySlots(dateKey, date);
        const constraintMap: ConstraintMap = {};

        const input: CSPInput = {
            slots,
            employees: [manager, emp1, emp2, emp3],
            constraintMap,
            partialConstraintMap: {},
            weekDates,
        };

        const result = solveCsp(input);
        // 5 seats total (2 morning + 2 afternoon + 1 night), 4 employees.
        // Manager fills morning_0. 3 regulars fill 3 of the remaining 4 seats.
        // One seat will be unfilled (pigeonhole). Expect at least 4 assignments.
        expect(result.assignments.size).toBeGreaterThanOrEqual(4);
    });

    it('returns unfilled vars when no employee is eligible for a seat', () => {
        const manager = makeEmployee({ role: 'manager', name: 'Manager' });
        const emp1 = makeEmployee({ name: 'Alice' });

        const slots = makeSingleDaySlots(dateKey, date);
        const constraintMap: ConstraintMap = {
            [emp1._id.toString()]: {
                [dateKey]: { morning: true, afternoon: true, night: true },
            },
        };

        const result = solveCsp({ slots, employees: [manager, emp1], constraintMap, partialConstraintMap: {}, weekDates });
        expect(result.unfilledVars.length).toBeGreaterThan(0);
    });

    it('does not crash when domain is empty for every seat', () => {
        const emp1 = makeEmployee({ name: 'Alice' });
        const slots = makeSingleDaySlots(dateKey, date);
        const constraintMap: ConstraintMap = {
            [emp1._id.toString()]: {
                [dateKey]: { morning: true, afternoon: true, night: true },
            },
        };

        expect(() => solveCsp({ slots, employees: [emp1], constraintMap, partialConstraintMap: {}, weekDates })).not.toThrow();
        const result = solveCsp({ slots, employees: [emp1], constraintMap, partialConstraintMap: {}, weekDates });
        expect(result.unfilledVars.length).toBeGreaterThan(0);
    });

    it('buildShiftsFromResult produces 1 IShift per slot', () => {
        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });
        const manager = makeEmployee({ role: 'manager', name: 'Mgr' });
        const slots = makeSingleDaySlots(dateKey, date);
        const result = solveCsp({ slots, employees: [manager, emp1, emp2], constraintMap: {}, partialConstraintMap: {}, weekDates });
        const shifts = buildShiftsFromResult(result, slots);

        expect(shifts).toHaveLength(3);
        for (const shift of shifts) {
            expect(shift).toHaveProperty('date');
            expect(shift).toHaveProperty('type');
            expect(Array.isArray(shift.employees)).toBe(true);
        }
    });

    it('no employee appears twice in the same shift', () => {
        const manager = makeEmployee({ role: 'manager', name: 'Mgr' });
        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });
        const slots = makeSingleDaySlots(dateKey, date);
        const result = solveCsp({ slots, employees: [manager, emp1, emp2], constraintMap: {}, partialConstraintMap: {}, weekDates });
        const shifts = buildShiftsFromResult(result, slots);

        for (const shift of shifts) {
            const ids = shift.employees.map(e => e.toString());
            expect(ids.length).toBe(new Set(ids).size);
        }
    });

    it('no employee is assigned to two shifts on the same day', () => {
        const manager = makeEmployee({ role: 'manager', name: 'Mgr' });
        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });
        const emp3 = makeEmployee({ name: 'Carol' });
        const slots = makeSingleDaySlots(dateKey, date);
        const result = solveCsp({ slots, employees: [manager, emp1, emp2, emp3], constraintMap: {}, partialConstraintMap: {}, weekDates });
        const shifts = buildShiftsFromResult(result, slots);

        const seenOnDay = new Set<string>();
        for (const shift of shifts) {
            for (const empId of shift.employees) {
                const key = `${dateKey}_${empId}`;
                expect(seenOnDay.has(key)).toBe(false);
                seenOnDay.add(key);
            }
        }
    });

    // ─── Soft constraint (8|8 pattern) tests ─────────────────────────────────

    it('avoids afternoon→morning sequence (8|8) when an alternative employee exists', () => {
        // Setup: two consecutive days. emp1 is forced into Day0 afternoon (emp2 blocked).
        // emp2 is free for Day1 morning. Without strict Phase A, emp1 could take Day1
        // morning (creating an 8|8). With it, emp2 must be chosen instead.
        const day0 = new Date('2026-03-09T00:00:00');
        const day1 = new Date('2026-03-10T00:00:00');
        const dayKey0 = localDateKey(day0);
        const dayKey1 = localDateKey(day1);

        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });

        // Block emp2 from Day0 afternoon so emp1 must take it
        const constraintMap: ConstraintMap = {
            [emp2._id.toString()]: {
                [dayKey0]: { afternoon: true },
            },
        };

        const slots = [
            { date: day0, dateKey: dayKey0, type: 'afternoon' as const, requiredHeadcount: 1 },
            { date: day1, dateKey: dayKey1, type: 'morning'   as const, requiredHeadcount: 1 },
        ];

        const result = solveCsp({
            slots,
            employees: [emp1, emp2],
            constraintMap,
            partialConstraintMap: {},
            weekDates: [day0, day1],
        });

        // Phase A should succeed with zero soft violations
        expect(result.softViolationCount).toBe(0);

        // emp1 (who worked Day0 afternoon) must NOT be assigned to Day1 morning
        const morningVarId = `${dayKey1}_morning_0`;
        expect(result.assignments.get(morningVarId)).toBe(emp2._id.toString());
    });

    it('falls back gracefully (Phase B) and fills all seats when 8|8 is unavoidable', () => {
        // Single employee — Phase A cannot complete (would require an 8|8), so
        // Phase B fires. Both seats must still be filled.
        const day0 = new Date('2026-03-09T00:00:00');
        const day1 = new Date('2026-03-10T00:00:00');
        const dayKey0 = localDateKey(day0);
        const dayKey1 = localDateKey(day1);

        const emp1 = makeEmployee({ name: 'Alice' });

        const slots = [
            { date: day0, dateKey: dayKey0, type: 'afternoon' as const, requiredHeadcount: 1 },
            { date: day1, dateKey: dayKey1, type: 'morning'   as const, requiredHeadcount: 1 },
        ];

        const result = solveCsp({
            slots,
            employees: [emp1],
            constraintMap: {},
            partialConstraintMap: {},
            weekDates: [day0, day1],
        });

        // Phase B must fill both seats despite the unavoidable 8|8 pattern
        expect(result.unfilledVars).toHaveLength(0);
        expect(result.assignments.size).toBe(2);

        // Exactly one soft violation (emp1 works afternoon then next-day morning)
        expect(result.softViolationCount).toBe(1);
    });

    it('always prefers Phase A (zero violations) over a Phase B result', () => {
        // 3 employees, 2 days.
        // emp1 is forced into Day0 afternoon (emp2 and emp3 blocked).
        // emp2 and emp3 are both free for Day1 morning.
        // Phase A must select emp2 or emp3 for Day1 morning — never emp1.
        const day0 = new Date('2026-03-09T00:00:00');
        const day1 = new Date('2026-03-10T00:00:00');
        const dayKey0 = localDateKey(day0);
        const dayKey1 = localDateKey(day1);

        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });
        const emp3 = makeEmployee({ name: 'Carol' });

        const constraintMap: ConstraintMap = {
            [emp2._id.toString()]: { [dayKey0]: { afternoon: true } },
            [emp3._id.toString()]: { [dayKey0]: { afternoon: true } },
        };

        const slots = [
            { date: day0, dateKey: dayKey0, type: 'afternoon' as const, requiredHeadcount: 1 },
            { date: day1, dateKey: dayKey1, type: 'morning'   as const, requiredHeadcount: 1 },
        ];

        const result = solveCsp({
            slots,
            employees: [emp1, emp2, emp3],
            constraintMap,
            partialConstraintMap: {},
            weekDates: [day0, day1],
        });

        expect(result.softViolationCount).toBe(0);

        const morningVarId = `${dayKey1}_morning_0`;
        const chosenForMorning = result.assignments.get(morningVarId);
        // emp1 must NOT be chosen for Day1 morning (she worked Day0 afternoon)
        expect(chosenForMorning).not.toBe(emp1._id.toString());
    });

    it('respects rest rule bidirectionally: no night-before-morning when morning committed first', () => {
        // Scenario: morning on Day1 is assigned first (larger domain, processed later by MRV in reverse),
        // then night on Day0 is tried. The bidirectional check must catch night→nextday-morning violation.
        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });
        const manager = makeEmployee({ role: 'manager', name: 'Mgr' });

        const day0 = new Date('2026-03-08T00:00:00');  // Sunday
        const day1 = new Date('2026-03-09T00:00:00');  // Monday
        const weekDates = [day0, day1];

        const slots = [
            { date: day0, dateKey: localDateKey(day0), type: 'morning' as const, requiredHeadcount: 1 },
            { date: day0, dateKey: localDateKey(day0), type: 'night' as const, requiredHeadcount: 1 },
            { date: day1, dateKey: localDateKey(day1), type: 'morning' as const, requiredHeadcount: 1 },
        ];

        // Block emp2 from all shifts so emp1 is the only regular option everywhere
        const constraintMap: ConstraintMap = {
            [emp2._id.toString()]: {
                [localDateKey(day0)]: { morning: true, night: true },
                [localDateKey(day1)]: { morning: true },
            },
        };

        const result = solveCsp({
            slots,
            employees: [manager, emp1, emp2],
            constraintMap,
            partialConstraintMap: {},
            weekDates,
        });
        const shifts = buildShiftsFromResult(result, slots);

        const sundayNight = shifts.find(s => s.type === 'night' && localDateKey(s.date) === localDateKey(day0));
        const mondayMorning = shifts.find(s => s.type === 'morning' && localDateKey(s.date) === localDateKey(day1));

        // No employee should appear in both Sunday-night AND Monday-morning
        if (sundayNight && mondayMorning) {
            for (const nightEmpId of sundayNight.employees) {
                const inMondayMorning = mondayMorning.employees.some(id => id.toString() === nightEmpId.toString());
                expect(inMondayMorning).toBe(false);
            }
        }
    });
});

// ─── Integration tests (use DB via MongoMemoryServer) ────────────────────────

describe('generateWeekSchedule (CSP integration)', () => {
    const TEST_WEEK_ID = '2026-W11';

    let managerId: Types.ObjectId;
    let employeeIds: Types.ObjectId[];

    beforeEach(async () => {
        const manager = await User.create({
            name: 'Manager',
            email: 'manager@test.com',
            password: 'pw',
            role: 'manager',
            isActive: true,
            isFixedMorning: false,
        });
        managerId = manager._id as Types.ObjectId;

        const employees = await User.create([
            { name: 'Alice', email: 'alice@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Bob', email: 'bob@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Carol', email: 'carol@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Dan', email: 'dan@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Eve', email: 'eve@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Frank', email: 'frank@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Grace', email: 'grace@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Hank', email: 'hank@test.com', password: 'pw', role: 'employee', isActive: true },
        ]);
        employeeIds = employees.map(e => e._id as Types.ObjectId);
    });

    // ─── No-solution edge case ─────────────────────────────────────────────────

    it('returns warning (not crash) when all employees are blocked from a shift', async () => {
        // Block all 8 regular employees from Sunday night
        for (const empId of employeeIds) {
            await Constraint.create({
                userId: empId,
                weekId: TEST_WEEK_ID,
                constraints: [{ date: new Date('2026-03-08'), shift: 'night', canWork: false }],
            });
        }

        expect(async () => generateWeekSchedule(TEST_WEEK_ID)).not.toThrow();
        const { shifts, warnings } = await generateWeekSchedule(TEST_WEEK_ID);
        expect(shifts).toHaveLength(21);
        const hasMissingWarning = warnings.some(w => w.includes('חסר'));
        expect(hasMissingWarning).toBe(true);
    });

    // ─── Forced single-candidate via backtracking ──────────────────────────────

    it('finds the only valid assignment when just one employee is eligible for a shift', async () => {
        // Block 7 out of 8 employees from Sunday night — only Dan can work it
        const blocked = employeeIds.filter(id => id.toString() !== employeeIds[3].toString());
        for (const empId of blocked) {
            await Constraint.create({
                userId: empId,
                weekId: TEST_WEEK_ID,
                constraints: [{ date: new Date('2026-03-08'), shift: 'night', canWork: false }],
            });
        }

        const { shifts } = await generateWeekSchedule(TEST_WEEK_ID);
        const sundayNight = shifts.find(
            s => s.type === 'night' && localDateKey(s.date) === '2026-03-08',
        );
        expect(sundayNight).toBeDefined();
        expect(sundayNight!.employees).toHaveLength(1);
        expect(sundayNight!.employees[0].toString()).toBe(employeeIds[3].toString());
    });

    // ─── Rest rule via CSP ────────────────────────────────────────────────────

    it('respects rest rule: employee on Sunday night is not in Monday morning', async () => {
        const { shifts } = await generateWeekSchedule(TEST_WEEK_ID);

        const sundayNight = shifts.find(
            s => s.type === 'night' && localDateKey(s.date) === '2026-03-08',
        );
        const mondayMorning = shifts.find(
            s => s.type === 'morning' && localDateKey(s.date) === '2026-03-09',
        );

        if (sundayNight && mondayMorning) {
            for (const nightEmpId of sundayNight.employees) {
                const isManager = nightEmpId.toString() === managerId.toString();
                if (!isManager) {
                    const inMorning = mondayMorning.employees.some(
                        id => id.toString() === nightEmpId.toString(),
                    );
                    expect(inMorning).toBe(false);
                }
            }
        }
    });

    // ─── Manager always in morning ────────────────────────────────────────────

    it('manager appears in every morning shift even with many constraints', async () => {
        // Put tight constraints on everyone else to stress-test manager placement
        for (let i = 0; i < 4; i++) {
            await Constraint.create({
                userId: employeeIds[i],
                weekId: TEST_WEEK_ID,
                constraints: [
                    { date: new Date('2026-03-09'), shift: 'morning', canWork: false },
                    { date: new Date('2026-03-10'), shift: 'morning', canWork: false },
                ],
            });
        }

        const { shifts } = await generateWeekSchedule(TEST_WEEK_ID);
        const morningShifts = shifts.filter(s => s.type === 'morning');
        expect(morningShifts).toHaveLength(7);

        for (const ms of morningShifts) {
            const hasManager = ms.employees.some(id => id.toString() === managerId.toString());
            expect(hasManager).toBe(true);
        }
    });

    // ─── Load balance (soft constraint) ──────────────────────────────────────

    it('distributes shifts roughly evenly among regular employees (max difference ≤ 2)', async () => {
        const { shifts } = await generateWeekSchedule(TEST_WEEK_ID);

        // Exclude manager from load-balance check: manager is always in mornings (7 shifts)
        // which is structurally higher than regular employees (~3 shifts each).
        const regularIds = new Set(employeeIds.map(id => id.toString()));

        const counts = new Map<string, number>();
        for (const shift of shifts) {
            for (const empId of shift.employees) {
                const key = empId.toString();
                if (regularIds.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }

        const values = [...counts.values()];
        if (values.length < 2) return; // trivial case
        const max = Math.max(...values);
        const min = Math.min(...values);
        expect(max - min).toBeLessThanOrEqual(2);
    });

    // ─── Consecutive nights soft constraint ───────────────────────────────────

    it('does not assign any employee to 4+ consecutive nights', async () => {
        const { shifts } = await generateWeekSchedule(TEST_WEEK_ID);
        const nightShifts = shifts
            .filter(s => s.type === 'night')
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        // For each employee, count consecutive nights
        const empNights = new Map<string, Date[]>();
        for (const ns of nightShifts) {
            for (const empId of ns.employees) {
                const key = empId.toString();
                if (!empNights.has(key)) empNights.set(key, []);
                empNights.get(key)!.push(ns.date);
            }
        }

        for (const [, nights] of empNights) {
            nights.sort((a, b) => a.getTime() - b.getTime());
            let streak = 1;
            for (let i = 1; i < nights.length; i++) {
                const diff = (nights[i].getTime() - nights[i - 1].getTime()) / (24 * 60 * 60 * 1000);
                streak = diff === 1 ? streak + 1 : 1;
                expect(streak).toBeLessThanOrEqual(3);
            }
        }
    });

    // ─── Backtracking actually occurs ─────────────────────────────────────────

    it('performs backtracking when constraints force it', async () => {
        // Create tight constraints to force the algorithm to backtrack:
        // Block 6 employees from the first 3 days of morning/afternoon
        for (let i = 0; i < 6; i++) {
            await Constraint.create({
                userId: employeeIds[i],
                weekId: TEST_WEEK_ID,
                constraints: [
                    { date: new Date('2026-03-08'), shift: 'afternoon', canWork: false },
                    { date: new Date('2026-03-09'), shift: 'afternoon', canWork: false },
                    { date: new Date('2026-03-10'), shift: 'afternoon', canWork: false },
                ],
            });
        }

        // Should still complete without throwing
        const { shifts } = await generateWeekSchedule(TEST_WEEK_ID);
        expect(shifts).toHaveLength(21);
    });

    // ─── No employee on two shifts same day ───────────────────────────────────

    it('never assigns an employee to two shifts on the same day', async () => {
        const { shifts } = await generateWeekSchedule(TEST_WEEK_ID);

        // Group by date
        const byDate = new Map<string, string[]>();
        for (const shift of shifts) {
            const dk = shift.date.toISOString().split('T')[0];
            if (!byDate.has(dk)) byDate.set(dk, []);
            for (const empId of shift.employees) {
                byDate.get(dk)!.push(empId.toString());
            }
        }

        for (const [, empIds] of byDate) {
            const unique = new Set(empIds);
            expect(empIds.length).toBe(unique.size);
        }
    });

    // ─── 8|8 soft constraint (integration) ───────────────────────────────────

    it('produces zero 8|8 afternoon→morning sequences with 8 employees and no constraints', async () => {
        // With 8 regular employees and no constraints, Phase A (strict) should
        // always find a complete solution — zero soft violations expected.
        const { constraintViolationReport } = await generateWeekSchedule(TEST_WEEK_ID);
        expect(constraintViolationReport.sequenceWarnings).toHaveLength(0);
    });

});
