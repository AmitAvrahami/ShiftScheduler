import { Employee, Shift, ScheduleMap, ScheduleEvaluation } from './types';
import { validateHardConstraints, calculatePenaltyScore } from './ScoringEngine';

/**
 * Options for the Simulated Annealing heuristic search
 */
export interface SchedulerOptions {
    /** Maximum number of iterations to run before stopping (e.g., 10000) */
    maxIterations?: number;
    /** The initial "temperature" for Simulated Annealing. Higher = more random jumps initially */
    startTemperature?: number;
    /** How quickly the algorithm "cools down" (locks into the best solution). Usually between 0.8 and 0.99 */
    coolingRate?: number;
}

/**
 * Generates an initial assignment that satisfies the coverage requirements of the shifts.
 * This does NOT guarantee hard constraints are met for employees, it just fills the slots
 * to give the algorithm a starting point.
 */
function generateRandomInitialSchedule(employees: Employee[], shifts: Shift[]): ScheduleMap {
    const schedule: ScheduleMap = new Map();

    for (const shift of shifts) {
        const assigned: string[] = [];
        // Randomly pick employees until we meet min required
        const availableEmployees = [...employees];

        // Very basic randomization for starting state
        for (let i = 0; i < shift.minRequiredEmployees; i++) {
            if (availableEmployees.length === 0) break;
            const randomIndex = Math.floor(Math.random() * availableEmployees.length);
            assigned.push(availableEmployees[randomIndex].id);
            // Remove from available so we don't assign same person twice to same shift
            availableEmployees.splice(randomIndex, 1);
        }
        schedule.set(shift.id, assigned);
    }
    return schedule;
}

/**
 * Clones a schedule map so we can mutate it safely
 */
function cloneSchedule(schedule: ScheduleMap): ScheduleMap {
    const cloned = new Map<string, string[]>();
    schedule.forEach((employeeIds, shiftId) => {
        cloned.set(shiftId, [...employeeIds]);
    });
    return cloned;
}

/**
 * Mutates a schedule by making a small random change.
 * Common mutations:
 * 1. Swap an employee between two shifts.
 * 2. Replace an assigned employee with an unassigned one for a specific shift.
 */
function mutateSchedule(schedule: ScheduleMap, employees: Employee[], shifts: Shift[]): ScheduleMap {
    const mutated = cloneSchedule(schedule);

    // Pick a random shift to mutate
    if (shifts.length === 0 || employees.length === 0) return mutated;
    const randomShiftIndex = Math.floor(Math.random() * shifts.length);
    const shiftToMutate = shifts[randomShiftIndex];

    const assignedIds = mutated.get(shiftToMutate.id) || [];

    // Pick a mutation strategy randomly
    const strategy = Math.random();

    if (strategy < 0.5 && assignedIds.length > 0) {
        // Strategy A: Replace an existing employee on this shift with a random other employee
        const employeeToReplaceIndex = Math.floor(Math.random() * assignedIds.length);
        const employeeToReplaceId = assignedIds[employeeToReplaceIndex];

        // Find an employee NOT currently on this shift
        const unassignedEmployees = employees.filter(e => !assignedIds.includes(e.id));
        if (unassignedEmployees.length > 0) {
            const randomNewEmployee = unassignedEmployees[Math.floor(Math.random() * unassignedEmployees.length)];
            assignedIds[employeeToReplaceIndex] = randomNewEmployee.id;
            mutated.set(shiftToMutate.id, assignedIds);
        }
    } else {
        // Strategy B: Take an employee from another shift and swap them here
        // (Assuming both shifts allow it)
        const otherShiftIndex = Math.floor(Math.random() * shifts.length);
        const otherShift = shifts[otherShiftIndex];

        if (otherShift.id !== shiftToMutate.id) {
            const otherAssignedIds = mutated.get(otherShift.id) || [];

            if (assignedIds.length > 0 && otherAssignedIds.length > 0) {
                const empIndexA = Math.floor(Math.random() * assignedIds.length);
                const empIndexB = Math.floor(Math.random() * otherAssignedIds.length);

                const empA = assignedIds[empIndexA];
                const empB = otherAssignedIds[empIndexB];

                // Only swap if they aren't already on each other's shifts
                if (!assignedIds.includes(empB) && !otherAssignedIds.includes(empA)) {
                    assignedIds[empIndexA] = empB;
                    otherAssignedIds[empIndexB] = empA;
                    mutated.set(shiftToMutate.id, assignedIds);
                    mutated.set(otherShift.id, otherAssignedIds);
                }
            }
        }
    }

    return mutated;
}

/**
 * Highly optimized Heuristic Search using Simulated Annealing.
 * The goal is to find a schedule that breaks ZERO hard constraints, 
 * and has the lowest possible penalty score for broken soft constraints.
 * 
 * @returns The best ScheduleEvaluation found.
 */
export function runHeuristicSearch(
    employees: Employee[],
    shifts: Shift[],
    options: SchedulerOptions = {}
): ScheduleEvaluation {
    const MAX_ITERATIONS = options.maxIterations || 5000;
    let temperature = options.startTemperature || 100.0;
    const coolingRate = options.coolingRate || 0.95;

    // 1. Generate an initial schedule state
    let currentSchedule = generateRandomInitialSchedule(employees, shifts);

    // Evaluate initial state. 
    // We treat invalid hard constraints as a MASSIVE penalty so the algorithm runs away from them.
    let currentHardViolations = validateHardConstraints(currentSchedule, employees, shifts);
    let currentSoftPenalty = calculatePenaltyScore(currentSchedule, employees, shifts);

    // Energy represents how "bad" the schedule is. Lower Energy = Better Schedule.
    // We add 10,000 for every hard constraint broken to ensure valid schedules always win over invalid ones.
    let currentEnergy = (currentHardViolations.length * 10000) + currentSoftPenalty.score;

    // Tracking the absolute best valid schedule we've ever seen
    let bestEnergy = currentEnergy;
    let bestSchedule = cloneSchedule(currentSchedule);
    let bestHardViolations = currentHardViolations;
    let bestSoftPenalty = currentSoftPenalty;

    // 2. Loop and Anneal
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // Create a mutated neighbor
        const neighborSchedule = mutateSchedule(currentSchedule, employees, shifts);

        const neighborHardViolations = validateHardConstraints(neighborSchedule, employees, shifts);
        const neighborSoftPenalty = calculatePenaltyScore(neighborSchedule, employees, shifts);
        const neighborEnergy = (neighborHardViolations.length * 10000) + neighborSoftPenalty.score;

        // Is it better?
        if (neighborEnergy < currentEnergy) {
            // Unconditionally accept it
            currentSchedule = neighborSchedule;
            currentEnergy = neighborEnergy;
            currentHardViolations = neighborHardViolations;
            currentSoftPenalty = neighborSoftPenalty;

            // Did it beat our all-time best?
            if (currentEnergy < bestEnergy) {
                bestEnergy = currentEnergy;
                bestSchedule = cloneSchedule(currentSchedule);
                bestHardViolations = currentHardViolations;
                bestSoftPenalty = currentSoftPenalty;

                // If we found a perfect schedule (0 energy), we can stop early!
                if (bestEnergy === 0) {
                    console.log(`Perfect schedule found at iteration ${i}!`);
                    break;
                }
            }
        } else {
            // Simulated Annealing core concept:
            // Sometimes, accept a WORSE schedule initially to escape "local minimums".
            // The chance of accepting a worse schedule drops as the temperature drops.
            const acceptanceProbability = Math.exp((currentEnergy - neighborEnergy) / temperature);
            if (Math.random() < acceptanceProbability) {
                currentSchedule = neighborSchedule;
                currentEnergy = neighborEnergy;
                currentHardViolations = neighborHardViolations;
                currentSoftPenalty = neighborSoftPenalty;
            }
        }

        // Drop the temperature (Cooling)
        temperature *= coolingRate;

        // Add a safety catch to ensure we don't drop to standard JS underflow representing exactly 0.
        if (temperature < 0.0001) {
            temperature = 0.0001;
        }
    }

    return {
        schedule: bestSchedule,
        isValid: bestHardViolations.length === 0,
        penaltyScore: bestSoftPenalty.score,
        constraintViolations: [...bestHardViolations, ...bestSoftPenalty.violations]
    };
}
