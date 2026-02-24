import { Employee, Shift, ScheduleMap, ConstraintViolation } from './types';

/**
 * Validates a generated schedule against all Hard Contraints.
 * This function returns early if any constraint is broken.
 * 
 * @param schedule The current generated schedule assignment
 * @param employees Array of all employees in the system
 * @param shifts Array of all shifts in the system
 * @returns An array of ConstraintViolation objects. If length is 0, the schedule is valid.
 */
export function validateHardConstraints(
    schedule: ScheduleMap,
    employees: Employee[],
    shifts: Shift[]
): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Group shifts by employee for easier analysis
    const employeeShifts = new Map<string, Shift[]>();

    schedule.forEach((assignedEmployeeIds, shiftId) => {
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return;

        assignedEmployeeIds.forEach(empId => {
            if (!employeeShifts.has(empId)) {
                employeeShifts.set(empId, []);
            }
            employeeShifts.get(empId)!.push(shift);
        });
    });

    // 1. HARD CONSTRAINT: Minimum Rest Period (8 Hours)
    for (const [employeeId, assignedShifts] of employeeShifts.entries()) {
        // Sort shifts chronologically
        const sortedShifts = assignedShifts.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        for (let i = 0; i < sortedShifts.length - 1; i++) {
            const currentShift = sortedShifts[i];
            const nextShift = sortedShifts[i + 1];

            // Calculate the gap in hours between the end of one shift and the start of the next
            const msDifference = nextShift.startTime.getTime() - currentShift.endTime.getTime();
            const hoursDifference = msDifference / (1000 * 60 * 60);

            // If they have less than 8 hours rest between shifts
            if (hoursDifference < 8) {
                violations.push({
                    ruleCode: 'MINIMUM_REST_VIOLATION',
                    type: 'hard',
                    message: `Employee ${employeeId} does not have 8 hours of rest between shifts ${currentShift.id} and ${nextShift.id}. Only ${hoursDifference.toFixed(2)} hours given.`,
                    employeeIds: [employeeId],
                    shiftIds: [currentShift.id, nextShift.id]
                });

                // Return early for performance since ANY hard violation means failure
                return violations;
            }
        }
    }

    // TODO: Implement Overlapping constraint
    // TODO: Implement Availability constraint
    // TODO: Implement Max Daily Hours constraint

    return violations;
}

/**
 * Calculates a penalty score based on soft constraints.
 * Lower score is a better schedule. 0 is perfect.
 * 
 * @param schedule The current generated schedule assignment
 * @param employees Array of all employees in the system
 * @param shifts Array of all shifts in the system
 * @returns The total penalty score and specific violations
 */
export function calculatePenaltyScore(
    schedule: ScheduleMap,
    employees: Employee[],
    shifts: Shift[]
): { score: number; violations: ConstraintViolation[] } {
    let totalScore = 0;
    const violations: ConstraintViolation[] = [];

    // Re-group shifts by employee to calculate distribution
    const employeeShifts = new Map<string, Shift[]>();
    schedule.forEach((assignedEmployeeIds, shiftId) => {
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift) return;
        assignedEmployeeIds.forEach(empId => {
            if (!employeeShifts.has(empId)) employeeShifts.set(empId, []);
            employeeShifts.get(empId)!.push(shift);
        });
    });

    // SOFT CONSTRAINT: Equal distribution of problematic shifts (e.g., nights)
    // Let's assume a "night" shift is problematic.
    // We want to penalize variance.

    const nightShiftCounts: Record<string, number> = {};
    employees.forEach(emp => { nightShiftCounts[emp.id] = 0; }); // Initialize all to 0

    for (const [employeeId, assignedShifts] of employeeShifts.entries()) {
        const nights = assignedShifts.filter(s => s.type === 'night').length;
        nightShiftCounts[employeeId] = nights;
    }

    // Calculate Average number of night shifts per employee
    const totalNights = Object.values(nightShiftCounts).reduce((sum, count) => sum + count, 0);

    // If there are night shifts to distribute, check for fairness
    if (totalNights > 0 && employees.length > 0) {
        const averageNights = totalNights / employees.length;

        // Penalize deviation from the average
        for (const [employeeId, count] of Object.entries(nightShiftCounts)) {
            // Calculate how far off this employee is from the expected average
            const deviation = Math.abs(count - averageNights);

            // If deviation is greater than 1 shift, start penalizing heavily
            if (deviation > 1) {
                // Quadratic penalty: Being off by 2 costs 4 points, by 3 costs 9 points...
                const penalty = Math.pow(deviation, 2) * 10;
                totalScore += penalty;

                violations.push({
                    ruleCode: 'UNEVEN_NIGHT_SHIFTS',
                    type: 'soft',
                    message: `Employee ${employeeId} has an unfair share of night shifts (${count} vs average ${averageNights.toFixed(1)}). Added penalty: ${penalty.toFixed(1)}`,
                    employeeIds: [employeeId],
                    shiftIds: [] // No specific shift is at fault, but rather the distribution itself
                });
            }
        }
    }

    // TODO: Add Preferred/Avoid shift penalties
    // TODO: Add Weekend distribution penalties

    return { score: totalScore, violations };
}
