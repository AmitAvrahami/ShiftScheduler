/**
 * Core Types for the Shift Scheduling Algorithm
 * 
 * Defines the core models and interfaces used by the Heuristic Search and Scoring Engine.
 */

// --- Enums & Primitive Types ---

export type ShiftType = 'morning' | 'evening' | 'night' | 'custom';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday

// --- Entities ---

/**
 * Represents a worker in the system.
 */
export interface Employee {
    /** Unique identifier for the employee */
    id: string;
    /** Human-readable name */
    name: string;
    /** Maximum number of hours this employee can work per day (Hard Constraint) */
    maxDailyHours: number;
    /** Maximum consecutive days they can work (Hard Constraint) */
    maxConsecutiveDays: number;

    // -- Soft Constraints / Preferences --

    /** Types of shifts the employee prefers (e.g., ['morning']) */
    preferredShiftTypes?: ShiftType[];
    /** Types of shifts the employee explicitly wants to avoid (e.g., ['night']) */
    avoidShiftTypes?: ShiftType[];
    /** Specific dates (YYYY-MM-DD) they prefer to work */
    preferredDates?: string[];
    /** Specific dates (YYYY-MM-DD) they prefer NOT to work */
    avoidDates?: string[];

    // -- Availability (Hard Constraints) --

    /** Dates the employee is on vacation (cannot be scheduled) */
    vacationDates?: string[];
    /** Specific Time blocks they cannot work (Array of ISO Date strings or similar) */
    unavailableTimeBlocks?: { start: Date; end: Date }[];
}

/**
 * Represents a single shift that needs to be filled.
 */
export interface Shift {
    /** Unique identifier for the shift */
    id: string;
    /** Date of the shift (YYYY-MM-DD for easier grouping) */
    date: string;
    /** Start time of the shift */
    startTime: Date;
    /** End time of the shift */
    endTime: Date;
    /** Classification of the shift (Morning, Night, etc.) */
    type: ShiftType;
    /** Minimum number of employees required to fulfill this shift (Hard Constraint) */
    minRequiredEmployees: number;
    /** Optional max numbers of employees if we have overflow */
    maxAllowedEmployees?: number;
}

// --- Algorithm Specific Types ---

/**
 * Represents a fully built schedule.
 * Maps a Shift ID to an Array of Employee IDs assigned to that shift.
 */
export type ScheduleMap = Map<string, string[]>;

/**
 * Represents the final scored result of an algorithmic evaluation.
 */
export interface ScheduleEvaluation {
    /** The schedule that was evaluated */
    schedule: ScheduleMap;
    /** True if ALL hard constraints are completely satisfied */
    isValid: boolean;
    /** Total penalty score. Lower is better. 0 means perfect. */
    penaltyScore: number;
    /** Optional breakdown of which constraints were violated for debugging/UI */
    constraintViolations: ConstraintViolation[];
}

/**
 * Details about a specific constraint that was broken
 */
export interface ConstraintViolation {
    /** Unique code for the rule (e.g., 'MISSING_REST', 'UNEVEN_NIGHTS') */
    ruleCode: string;
    /** The severity or type of the rule */
    type: 'hard' | 'soft';
    /** Human readable description of what happened */
    message: string;
    /** The employees involved in the violation */
    employeeIds: string[];
    /** The shifts involved in the violation */
    shiftIds: string[];
}
