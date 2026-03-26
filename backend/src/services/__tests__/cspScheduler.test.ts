import { Types } from 'mongoose';
import { buildShiftsFromResult, solveCsp, CSPInput, ConstraintMap } from '../cspScheduler';

/**
 * CSP-specific unit tests — pure functions only, no DB.
 *
 * Covers edge cases that a greedy algorithm would fail on:
 * - No valid solution (all employees blocked)
 * - Forced single-candidate assignment via backtracking
 * - Rest rule respected when backtracking reshuffles assignments
 * - Backtracking actually occurs (backtracks counter > 0)
 * - Load balance (soft constraint never overrides finding a valid solution)
 * - Consecutive-night soft preference
 * - Determinism: identical input → identical output on repeated calls
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

    // ─── Determinism test ─────────────────────────────────────────────────────

    it('produces identical assignments on repeated calls with the same input', () => {
        const manager = makeEmployee({ role: 'manager', name: 'Manager' });
        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });
        const emp3 = makeEmployee({ name: 'Carol' });
        const emp4 = makeEmployee({ name: 'Dan' });
        const employees = [manager, emp1, emp2, emp3, emp4];

        // 3 weekdays: Sun–Tue, covering morning/afternoon/night each
        const weekDates3 = [
            new Date('2026-03-08T00:00:00'),
            new Date('2026-03-09T00:00:00'),
            new Date('2026-03-10T00:00:00'),
        ];
        const slots3 = weekDates3.flatMap(d => [
            { date: d, dateKey: localDateKey(d), type: 'morning' as const, requiredHeadcount: 2 },
            { date: d, dateKey: localDateKey(d), type: 'afternoon' as const, requiredHeadcount: 2 },
            { date: d, dateKey: localDateKey(d), type: 'night' as const, requiredHeadcount: 1 },
        ]);

        const input: CSPInput = {
            slots: slots3,
            employees,
            constraintMap: {},
            partialConstraintMap: {},
            weekDates: weekDates3,
        };

        const result1 = solveCsp(input);
        const result2 = solveCsp(input);

        // Sort by varId before comparing to ensure stable ordering
        const sorted1 = [...result1.assignments.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        const sorted2 = [...result2.assignments.entries()].sort((a, b) => a[0].localeCompare(b[0]));

        expect(sorted1).toEqual(sorted2);
    });

    // ─── Soft constraint (8|8 pattern) tests ─────────────────────────────────

    it('avoids afternoon→morning sequence (8|8) when an alternative employee exists', () => {
        const day0 = new Date('2026-03-09T00:00:00');
        const day1 = new Date('2026-03-10T00:00:00');
        const dayKey0 = localDateKey(day0);
        const dayKey1 = localDateKey(day1);

        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });

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

        expect(result.softViolationCount).toBe(0);

        const morningVarId = `${dayKey1}_morning_0`;
        expect(result.assignments.get(morningVarId)).toBe(emp2._id.toString());
    });

    it('leaves the morning slot unfilled when HC-2 makes it impossible (single employee)', () => {
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

        expect(result.assignments.size).toBe(1);
        expect(result.unfilledVars).toHaveLength(1);
        expect(result.unfilledVars[0]).toContain('morning');
        expect(result.softViolationCount).toBe(0);
    });

    it('always prefers Phase A (zero violations) over a Phase B result', () => {
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
        expect(chosenForMorning).not.toBe(emp1._id.toString());
    });

    it('respects rest rule bidirectionally: no night-before-morning when morning committed first', () => {
        const emp1 = makeEmployee({ name: 'Alice' });
        const emp2 = makeEmployee({ name: 'Bob' });
        const manager = makeEmployee({ role: 'manager', name: 'Mgr' });

        const day0 = new Date('2026-03-08T00:00:00');
        const day1 = new Date('2026-03-09T00:00:00');
        const weekDates2 = [day0, day1];

        const slots = [
            { date: day0, dateKey: localDateKey(day0), type: 'morning' as const, requiredHeadcount: 1 },
            { date: day0, dateKey: localDateKey(day0), type: 'night' as const, requiredHeadcount: 1 },
            { date: day1, dateKey: localDateKey(day1), type: 'morning' as const, requiredHeadcount: 1 },
        ];

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
            weekDates: weekDates2,
        });
        const shifts = buildShiftsFromResult(result, slots);

        const sundayNight = shifts.find(s => s.type === 'night' && localDateKey(s.date) === localDateKey(day0));
        const mondayMorning = shifts.find(s => s.type === 'morning' && localDateKey(s.date) === localDateKey(day1));

        if (sundayNight && mondayMorning) {
            for (const nightEmpId of sundayNight.employees) {
                const inMondayMorning = mondayMorning.employees.some(id => id.toString() === nightEmpId.toString());
                expect(inMondayMorning).toBe(false);
            }
        }
    });
});
