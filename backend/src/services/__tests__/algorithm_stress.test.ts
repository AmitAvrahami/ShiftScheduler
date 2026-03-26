import { Types } from 'mongoose';
import { User } from '../../models/User';
import { Constraint } from '../../models/Constraint';
import * as schedulerService from '../schedulerService';
import { getWeekDates } from '../../utils/weekUtils';
import { IShift } from '../../models/Schedule';
import { setupTestDatabase, teardownTestDatabase, clearCollections } from '../../test/dbSetup';

beforeAll(setupTestDatabase);
afterAll(teardownTestDatabase);
afterEach(clearCollections);

// ─── Shared Helpers ───────────────────────────────────────────────────────────

/** Timezone-safe date key using local time — matches cspScheduler's toDateKey */
function toLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Returns the first HC-2 violation found in the schedule, or null if clean.
 * Checks both afternoon→morning and night→morning consecutive-day patterns.
 * Both violate the 8-hour rest requirement defined in PRD HC-2.
 */
function findHC2Violation(shifts: IShift[], weekDates: Date[]): string | null {
    // Build empId → dateKey → shiftType
    const empSchedule = new Map<string, Map<string, string>>();
    for (const shift of shifts) {
        const dk = toLocalDateKey(shift.date);
        for (const empId of shift.employees) {
            const key = empId.toString();
            if (!empSchedule.has(key)) empSchedule.set(key, new Map());
            empSchedule.get(key)!.set(dk, shift.type);
        }
    }
    for (const [empId, schedule] of empSchedule) {
        for (let i = 0; i < weekDates.length - 1; i++) {
            const cur = schedule.get(toLocalDateKey(weekDates[i]));
            const nxt = schedule.get(toLocalDateKey(weekDates[i + 1]));
            if ((cur === 'afternoon' || cur === 'night') && nxt === 'morning') {
                return `emp ${empId}: ${cur} on ${toLocalDateKey(weekDates[i])} → morning on ${toLocalDateKey(weekDates[i + 1])}`;
            }
        }
    }
    return null;
}

// ─── Suite 1: Perfect Availability (0 constraints, 10 employees) ──────────────

/**
 * With zero employee constraints and a full team of 10, the algorithm should:
 *   - Complete in well under 5 seconds
 *   - Fill all 21 weekly shift slots
 *   - Produce zero HC-2 violations
 *
 * Uses week 2026-W25 (Sun 2026-06-14 → Sat 2026-06-20), safely in the future.
 */
describe('stress: perfect availability (0 constraints, 10 employees)', () => {
    const WEEK_ID = '2026-W25';

    beforeEach(async () => {
        await User.create({
            name: 'Manager',
            email: 'manager@stress1.com',
            password: 'pw',
            role: 'manager',
            isActive: true,
        });
        const names = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivan'];
        for (let i = 0; i < 9; i++) {
            await User.create({
                name: names[i],
                email: `${names[i].toLowerCase()}1@stress.com`,
                password: 'pw',
                role: 'employee',
                isActive: true,
            });
        }
    });

    it('completes in under 5000ms', async () => {
        const start = Date.now();
        await schedulerService.generateWeekSchedule(WEEK_ID);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(5000);
    });

    it('returns exactly 21 shifts', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(WEEK_ID);
        expect(shifts).toHaveLength(21);
    });

    it('produces no HC-2 violations (afternoon→morning or night→morning)', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(WEEK_ID);
        const weekDates = getWeekDates(WEEK_ID);
        const violation = findHC2Violation(shifts, weekDates);
        expect(violation).toBeNull();
    });
});

// ─── Suite 2: High Constraint (~50% unavailable) ──────────────────────────────

/**
 * With half the team blocked for more than half the week, the algorithm should:
 *   - Honour all HC-4 constraints (never assign blocked employees)
 *   - Produce zero HC-2 violations regardless of staffing pressure
 *   - Keep the manager out of non-morning shifts
 */
describe('stress: high constraint (~50% unavailable)', () => {
    const WEEK_ID = '2026-W25';

    let managerId: Types.ObjectId;
    let employeeIds: Types.ObjectId[];

    beforeEach(async () => {
        const manager = await User.create({
            name: 'Manager',
            email: 'manager@stress2.com',
            password: 'pw',
            role: 'manager',
            isActive: true,
        });
        managerId = manager._id as Types.ObjectId;

        const names = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivan'];
        const created = await User.create(
            names.map(n => ({
                name: n,
                email: `${n.toLowerCase()}2@stress.com`,
                password: 'pw',
                role: 'employee',
                isActive: true,
            })),
        );
        employeeIds = created.map(e => e._id as Types.ObjectId);
    });

    it('HC-4: never assigns a blocked employee to a blocked shift', async () => {
        const weekDates = getWeekDates(WEEK_ID);
        const blockedShifts = ['morning', 'afternoon', 'night'] as const;
        const blockedDays = [0, 1, 2, 3]; // Sunday through Wednesday

        // Block employees 0–4 on all 3 shifts for 4 days (~57% of week slots)
        for (let i = 0; i < 5; i++) {
            await Constraint.create({
                userId: employeeIds[i],
                weekId: WEEK_ID,
                constraints: blockedDays.flatMap(d =>
                    blockedShifts.map(shift => ({ date: weekDates[d], shift, canWork: false })),
                ),
            });
        }

        const { shifts } = await schedulerService.generateWeekSchedule(WEEK_ID);

        for (let i = 0; i < 5; i++) {
            const empId = employeeIds[i].toString();
            for (const d of blockedDays) {
                const dayKey = toLocalDateKey(weekDates[d]);
                for (const shiftType of blockedShifts) {
                    const shift = shifts.find(
                        s => toLocalDateKey(s.date) === dayKey && s.type === shiftType,
                    );
                    if (!shift) continue;
                    const isAssigned = shift.employees.some(id => id.toString() === empId);
                    expect(isAssigned).toBe(false);
                }
            }
        }
    });

    it('produces no HC-2 violations under staffing pressure', async () => {
        const weekDates = getWeekDates(WEEK_ID);
        const blockedShifts = ['morning', 'afternoon', 'night'] as const;
        const blockedDays = [0, 1, 2, 3];

        for (let i = 0; i < 5; i++) {
            await Constraint.create({
                userId: employeeIds[i],
                weekId: WEEK_ID,
                constraints: blockedDays.flatMap(d =>
                    blockedShifts.map(shift => ({ date: weekDates[d], shift, canWork: false })),
                ),
            });
        }

        const { shifts } = await schedulerService.generateWeekSchedule(WEEK_ID);
        const violation = findHC2Violation(shifts, weekDates);
        expect(violation).toBeNull();
    });

    it('manager only appears in morning shifts', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(WEEK_ID);
        for (const shift of shifts) {
            if (shift.type !== 'morning') {
                const hasManager = shift.employees.some(id => id.toString() === managerId.toString());
                expect(hasManager).toBe(false);
            }
        }
    });
});

// ─── Suite 3: Role Specific (manager + isFixedMorning employee) ───────────────

/**
 * With a manager and an isFixedMorning employee in the team, the algorithm should:
 *   - Assign the manager to every morning shift (HC-1)
 *   - Keep the isFixedMorning employee out of afternoon/night shifts
 *   - Distribute regular employees across afternoon and night shifts
 *   - Produce zero HC-2 violations
 */
describe('stress: role specific (manager + isFixedMorning employee)', () => {
    const WEEK_ID = '2026-W25';

    let managerId: Types.ObjectId;
    let fixedMorningId: Types.ObjectId;

    beforeEach(async () => {
        const manager = await User.create({
            name: 'Manager',
            email: 'manager@stress3.com',
            password: 'pw',
            role: 'manager',
            isActive: true,
        });
        managerId = manager._id as Types.ObjectId;

        const fixed = await User.create({
            name: 'FixedMorning',
            email: 'fixed@stress3.com',
            password: 'pw',
            role: 'employee',
            isActive: true,
            isFixedMorning: true,
        });
        fixedMorningId = fixed._id as Types.ObjectId;

        const names = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank', 'Grace'];
        for (const name of names) {
            await User.create({
                name,
                email: `${name.toLowerCase()}3@stress.com`,
                password: 'pw',
                role: 'employee',
                isActive: true,
            });
        }
    });

    it('manager appears in all 7 morning shifts', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(WEEK_ID);
        const morningShifts = shifts.filter(s => s.type === 'morning');
        expect(morningShifts).toHaveLength(7);
        for (const shift of morningShifts) {
            const hasManager = shift.employees.some(id => id.toString() === managerId.toString());
            expect(hasManager).toBe(true);
        }
    });

    it('isFixedMorning employee only appears in morning shifts', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(WEEK_ID);
        for (const shift of shifts) {
            if (shift.type !== 'morning') {
                const isAssigned = shift.employees.some(id => id.toString() === fixedMorningId.toString());
                expect(isAssigned).toBe(false);
            }
        }
    });

    it('produces no HC-2 violations', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(WEEK_ID);
        const weekDates = getWeekDates(WEEK_ID);
        const violation = findHC2Violation(shifts, weekDates);
        expect(violation).toBeNull();
    });

    it('regular employees appear in both afternoon and night shifts', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(WEEK_ID);
        const afternoonWorkers = new Set<string>();
        const nightWorkers = new Set<string>();
        for (const shift of shifts) {
            if (shift.type === 'afternoon') {
                for (const empId of shift.employees) afternoonWorkers.add(empId.toString());
            }
            if (shift.type === 'night') {
                for (const empId of shift.employees) nightWorkers.add(empId.toString());
            }
        }
        // With 7 regular employees covering 14 afternoon + 7 night slots there should be workers
        expect(afternoonWorkers.size).toBeGreaterThan(0);
        expect(nightWorkers.size).toBeGreaterThan(0);
    });
});
