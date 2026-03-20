import mongoose, { Types } from 'mongoose';
import { User } from '../../models/User';
import { Constraint } from '../../models/Constraint';
import * as schedulerService from '../schedulerService';

/** Local-time date key — matches cspScheduler's toDateKey and avoids UTC offset issues. */
function toLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Unit tests for the Greedy CSP scheduling algorithm.
 *
 * These tests use MongoMemoryServer (configured globally in setup.ts) and seed
 * real DB records to exercise the algorithm end-to-end without external dependencies.
 *
 * Week used throughout: 2026-W11 (Sun 2026-03-08 → Sat 2026-03-14)
 */
describe('schedulerService.generateWeekSchedule', () => {
    const TEST_WEEK_ID = '2026-W11';

    let managerId: Types.ObjectId;
    let employeeIds: Types.ObjectId[];

    beforeEach(async () => {
        // Seed 1 manager + 5 employees for each test
        const manager = await User.create({
            name: 'Manager',
            email: 'manager@test.com',
            password: 'pw',
            role: 'manager',
            isActive: true,
        });
        managerId = manager._id as Types.ObjectId;

        const employees = await User.create([
            { name: 'Alice', email: 'alice@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Bob', email: 'bob@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Carol', email: 'carol@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Dan', email: 'dan@test.com', password: 'pw', role: 'employee', isActive: true },
            { name: 'Eve', email: 'eve@test.com', password: 'pw', role: 'employee', isActive: true },
        ]);
        employeeIds = employees.map(e => e._id as Types.ObjectId);
    });

    // ─── Happy Path ───────────────────────────────────────────────────────────

    it('returns 21 shifts for a full week', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(TEST_WEEK_ID);
        expect(shifts).toHaveLength(21);
    });

    it('manager is assigned to every morning shift', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(TEST_WEEK_ID);

        const morningShifts = shifts.filter(s => s.type === 'morning');
        expect(morningShifts).toHaveLength(7); // 7 days

        for (const shift of morningShifts) {
            const hasManager = shift.employees.some(
                id => id.toString() === managerId.toString(),
            );
            expect(hasManager).toBe(true);
        }
    });

    it('includes unlocked-constraints warning when no lock exists', async () => {
        const { warnings } = await schedulerService.generateWeekSchedule(TEST_WEEK_ID);
        const hasUnlockedWarning = warnings.some(w => w.includes('טרם ננעלו'));
        expect(hasUnlockedWarning).toBe(true);
    });

    it('does NOT include unlocked-constraints warning when constraints are locked', async () => {
        await Constraint.create({
            userId: employeeIds[0],
            weekId: TEST_WEEK_ID,
            constraints: [],
            isLocked: true,
        });

        const { warnings } = await schedulerService.generateWeekSchedule(TEST_WEEK_ID);
        const hasUnlockedWarning = warnings.some(w => w.includes('טרם ננעלו'));
        expect(hasUnlockedWarning).toBe(false);
    });

    // ─── Constraint Respect ───────────────────────────────────────────────────

    it('does not assign employee to a shift they cannot work', async () => {
        // Alice cannot work morning on 2026-03-08 (first Sunday)
        await Constraint.create({
            userId: employeeIds[0], // Alice
            weekId: TEST_WEEK_ID,
            constraints: [
                { date: new Date('2026-03-08'), shift: 'morning', canWork: false },
            ],
        });

        const { shifts } = await schedulerService.generateWeekSchedule(TEST_WEEK_ID);

        const sundayMorning = shifts.find(
            s => s.type === 'morning' && toLocalDateKey(s.date) === '2026-03-08',
        );
        expect(sundayMorning).toBeDefined();

        const aliceAssigned = sundayMorning!.employees.some(
            id => id.toString() === employeeIds[0].toString(),
        );
        expect(aliceAssigned).toBe(false);
    });

    // ─── Rest Violation Rule ──────────────────────────────────────────────────

    it('does not assign employee to morning if they worked night the day before', async () => {
        const { shifts } = await schedulerService.generateWeekSchedule(TEST_WEEK_ID);

        // Find employees who worked night on Sunday (2026-03-08)
        const sundayNight = shifts.find(
            s => s.type === 'night' && toLocalDateKey(s.date) === '2026-03-08',
        );
        const mondayMorning = shifts.find(
            s => s.type === 'morning' && toLocalDateKey(s.date) === '2026-03-09',
        );

        if (sundayNight && mondayMorning) {
            for (const nightEmpId of sundayNight.employees) {
                // Manager may appear in morning regardless (manager is always morning — but
                // manager doesn't work non-morning shifts in the algorithm, so this won't clash)
                const isManager = nightEmpId.toString() === managerId.toString();
                if (!isManager) {
                    const alsoInMorning = mondayMorning.employees.some(
                        id => id.toString() === nightEmpId.toString(),
                    );
                    expect(alsoInMorning).toBe(false);
                }
            }
        }
    });

    // ─── Coverage & Warnings ──────────────────────────────────────────────────

    it('generates understaffed warning if not enough eligible employees for a shift', async () => {
        // Block all 5 employees from Sunday night — should trigger understaffed warning
        const sundayDate = new Date('2026-03-08');
        for (const empId of employeeIds) {
            await Constraint.create({
                userId: empId,
                weekId: TEST_WEEK_ID,
                constraints: [{ date: sundayDate, shift: 'night', canWork: false }],
            });
        }

        const { warnings } = await schedulerService.generateWeekSchedule(TEST_WEEK_ID);
        const hasUnderstaffedWarning = warnings.some(w => w.includes('חסר'));
        expect(hasUnderstaffedWarning).toBe(true);
    });

    // ─── Edge Cases ───────────────────────────────────────────────────────────

    it('handles an empty employee list gracefully (only manager)', async () => {
        // Remove all employees except manager
        await User.deleteMany({ role: 'employee' });

        const { shifts, warnings } = await schedulerService.generateWeekSchedule(TEST_WEEK_ID);
        expect(shifts).toHaveLength(21);
        // With only 1 user, all multi-employee shifts should have warnings
        const understaffedWarnings = warnings.filter(w => w.includes('חסר'));
        expect(understaffedWarnings.length).toBeGreaterThan(0);
    });

    it('isFixedMorning employee is treated as manager and assigned to all morning shifts', async () => {
        // Add a fixedMorning employee (not role=manager but isFixedMorning=true)
        const fixedMorningUser = await User.create({
            name: 'Fixed Morning',
            email: 'fixed@test.com',
            password: 'pw',
            role: 'employee',
            isActive: true,
            isFixedMorning: true,
        });

        const { shifts } = await schedulerService.generateWeekSchedule(TEST_WEEK_ID);

        const morningShifts = shifts.filter(s => s.type === 'morning');
        for (const shift of morningShifts) {
            const isAssigned = shift.employees.some(
                id => id.toString() === (fixedMorningUser._id as Types.ObjectId).toString(),
            );
            expect(isAssigned).toBe(true);
        }
    });

    // ─── Error Handling ───────────────────────────────────────────────────────

    it('throws Error for invalid weekId format', async () => {
        await expect(schedulerService.generateWeekSchedule('invalid')).rejects.toThrow();
    });
});
