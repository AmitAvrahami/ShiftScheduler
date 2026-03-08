import { Types } from 'mongoose';
import { User, IUser } from '../models/User';
import { Constraint, IConstraint } from '../models/Constraint';
import { IShift } from '../models/Schedule';
import { getWeekDates } from '../utils/weekUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ShiftType = 'morning' | 'afternoon' | 'night';

/** Identifies a single shift slot with its required headcount */
interface ShiftSlot {
    date: Date;
    /** ISO date string used as map key (e.g. "2026-03-08") */
    dateKey: string;
    type: ShiftType;
    requiredHeadcount: number;
}

/**
 * Map structure: userId → dateKey → shiftType → cannotWork (true = blocked)
 *
 * ```mermaid
 * graph TD
 *     A[ConstraintMap] --> B[userId string]
 *     B --> C[dateKey string]
 *     C --> D[shiftType]
 *     D --> E[cannot work = true]
 * ```
 */
type ConstraintMap = Record<string, Record<string, Record<string, boolean>>>;

/** Internal mutable employee state used during assignment */
interface EmployeeState {
    user: IUser & { _id: Types.ObjectId };
    /** Total shifts assigned so far (used for balance sorting) */
    totalAssigned: number;
    /** Maps dateKey → shift type they are already assigned on that day */
    assignedByDate: Record<string, ShiftType>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Shift timing labels for reference (not used in computation — baked in rules) */
const SHIFT_TIMES: Record<ShiftType, string> = {
    morning: '06:45-14:45',
    afternoon: '14:45-22:45',
    night: '22:45-06:45',
};

/** ISO day-of-week numbers — 0=Sunday, 5=Friday, 6=Saturday */
const FRIDAY = 5;
const SATURDAY = 6;

// ─── Pure Helper Functions ────────────────────────────────────────────────────

/**
 * Returns the ISO date-only string (YYYY-MM-DD) for a given Date.
 * Used as a stable map key independent of time.
 */
function toDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Builds a map: userId → dateKey → shiftType → cannotWork.
 * Only entries where canWork=false are inserted (those are the restrictions).
 */
function buildConstraintMap(constraints: IConstraint[]): ConstraintMap {
    const map: ConstraintMap = {};

    for (const doc of constraints) {
        const userId = doc.userId.toString();
        if (!map[userId]) map[userId] = {};

        for (const entry of doc.constraints) {
            // כאן מוכנסים רק האילוצים שהעובד לא יכול לעבוד בהם (canWork=false)
            if (!entry.canWork) {
                const key = toDateKey(new Date(entry.date));
                if (!map[userId][key]) map[userId][key] = {};
                map[userId][key][entry.shift] = true;
            }
        }
    }

    return map;
}

/**
 * Determines required headcount for a shift slot based on day-of-week.
 *
 * Business rules (HARD):
 * - Weekdays (Sun-Thu): Morning=2, Afternoon=2, Night=1
 * - Friday: Morning=2, Afternoon=1, Night=1
 * - Saturday: Morning=1, Afternoon=1, Night=1
 */
function getRequiredHeadcount(dayOfWeek: number, shiftType: ShiftType): number {
    if (dayOfWeek === SATURDAY) {
        return 1; // כל המשמרות בשבת = 1
    }
    if (dayOfWeek === FRIDAY) {
        // שישי: בוקר=2, שאר=1
        return shiftType === 'morning' ? 2 : 1;
    }
    // ימי חול: בוקר=2, צהריים=2, לילה=1
    return shiftType === 'night' ? 1 : 2;
}

/**
 * Builds the 21 ordered shift slots for the week (Sunday→Saturday, morning→afternoon→night).
 * Each slot carries its required headcount.
 */
function buildShiftSlots(weekDates: Date[]): ShiftSlot[] {
    const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night'];
    const slots: ShiftSlot[] = [];

    for (const date of weekDates) {
        const dayOfWeek = date.getDay(); // 0=Sun, 5=Fri, 6=Sat
        for (const type of shiftTypes) {
            slots.push({
                date,
                dateKey: toDateKey(date),
                type,
                requiredHeadcount: getRequiredHeadcount(dayOfWeek, type),
            });
        }
    }

    return slots;
}

/**
 * Checks if assigning `employee` to a `morning` shift on `dateKey`
 * violates the 8-hour rest rule.
 *
 * Rule (HARD): Employee cannot work Morning on day X if they worked Night on day X-1.
 *
 * @param employeeState - current assignment state for the employee
 * @param targetDateKey - ISO date key for the morning shift being considered
 * @param weekDates - all 7 dates of the week, used to find the day before
 */
function isRestViolated(
    employeeState: EmployeeState,
    targetDateKey: string,
    targetShiftType: ShiftType,
    weekDates: Date[],
): boolean {
    // הכלל הוחל רק על בוקר — בדוק אם יש לילה ביום הקודם
    if (targetShiftType !== 'morning') return false;

    const targetDate = weekDates.find(d => toDateKey(d) === targetDateKey);
    if (!targetDate) return false;

    const previousDay = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
    const previousDayKey = toDateKey(previousDay);

    // בדוק אם העובד עובד לילה ביום שקדם
    return employeeState.assignedByDate[previousDayKey] === 'night';
}

/**
 * Returns true if the employee should be considered a "fixed morning" employee
 * (the manager/fixed-morning person who must appear in every morning shift).
 */
function isManagerEmployee(user: IUser): boolean {
    return user.role === 'manager' || user.isFixedMorning === true;
}

// ─── Main Algorithm ───────────────────────────────────────────────────────────

/**
 * Generates a shift schedule for the given weekId using a custom Greedy CSP algorithm.
 *
 * ```mermaid
 * graph TD
 *     A[Start: weekId] --> B[Fetch active users + constraints]
 *     B --> C[Build constraint map]
 *     C --> D[Build 21 shift slots]
 *     D --> E{For each slot}
 *     E --> F[Filter eligible employees]
 *     F --> G[Sort by assigned count ascending]
 *     G --> H[Assign top N employees]
 *     H --> I{More slots?}
 *     I -->|Yes| E
 *     I -->|No| J[Check for understaffed warnings]
 *     J --> K[Return shifts + warnings]
 * ```
 *
 * Does NOT save to DB — the calling controller handles persistence.
 *
 * @param weekId - Week identifier in format "YYYY-Www" (e.g., "2026-W11")
 * @returns Resolved shifts array and array of Hebrew warning messages
 */
export async function generateWeekSchedule(
    weekId: string,
): Promise<{ shifts: IShift[]; warnings: string[] }> {
    const warnings: string[] = [];

    // 1. שליפת נתונים מה-DB
    const activeUsers = await User.find({ isActive: true }).lean<(IUser & { _id: Types.ObjectId })[]>();
    const constraintDocs = await Constraint.find({ weekId }).lean<IConstraint[]>();

    // 2. אזהרה אם האילוצים לא ננעלו
    const hasLockedConstraints = constraintDocs.some(c => c.isLocked);
    if (!hasLockedConstraints) {
        warnings.push('שים לב: האילוצים לשבוע זה טרם ננעלו');
    }

    // 3. בניית מפת אילוצים
    const constraintMap = buildConstraintMap(constraintDocs);

    // 4. חישוב תאריכי שבוע
    const weekDates = getWeekDates(weekId);

    // 5. בניית 21 חריצי משמרת
    const shiftSlots = buildShiftSlots(weekDates);

    // 6. אתחול מצב עובדים
    const employeeStates = new Map<string, EmployeeState>();
    for (const user of activeUsers) {
        employeeStates.set(user._id.toString(), {
            user,
            totalAssigned: 0,
            assignedByDate: {},
        });
    }

    // 7. Greedy assignment — לכל חריץ משמרת
    const assignedShifts: IShift[] = [];

    for (const slot of shiftSlots) {
        const assignedEmployeeIds: Types.ObjectId[] = [];

        // 7a. מציאת מנהל (תמיד ראשון לבוקר)
        const managerState = [...employeeStates.values()].find(s =>
            isManagerEmployee(s.user),
        );

        if (slot.type === 'morning' && managerState) {
            const managerId = managerState.user._id.toString();
            assignedEmployeeIds.push(managerState.user._id);

            // עדכון מצב מנהל
            managerState.totalAssigned += 1;
            managerState.assignedByDate[slot.dateKey] = slot.type;
            employeeStates.set(managerId, managerState);
        }

        // 7b. סינון עובדים כשירים (לא-מנהל) לחריץ זה
        const currentAssignedCount = assignedEmployeeIds.length;
        const stillNeeded = slot.requiredHeadcount - currentAssignedCount;

        if (stillNeeded > 0) {
            // מיון עובדים לפי מספר משמרות שהוקצו (עולה) — לאיזון
            const sortedCandidates = [...employeeStates.values()]
                .filter(state => {
                    const userId = state.user._id.toString();
                    const userIsManager = isManagerEmployee(state.user);

                    // דלג על מנהל (כבר הוקצה למעלה לבוקר)
                    if (slot.type === 'morning' && userIsManager) return false;

                    // דלג על עובד שכבר הוקצה לאותו יום
                    if (state.assignedByDate[slot.dateKey] !== undefined) return false;

                    // דלג אם יש הפרת מנוחה (לילה אתמול → בוקר היום)
                    if (isRestViolated(state, slot.dateKey, slot.type, weekDates)) return false;

                    // דלג אם העובד מגביל את עצמו לחריץ זה
                    if (constraintMap[userId]?.[slot.dateKey]?.[slot.type]) return false;

                    return true;
                })
                .sort((a, b) => a.totalAssigned - b.totalAssigned);

            // הקצאת N העובדים הראשונים עם הכי פחות משמרות
            const selected = sortedCandidates.slice(0, stillNeeded);
            for (const candidate of selected) {
                const candidateId = candidate.user._id.toString();
                assignedEmployeeIds.push(candidate.user._id);

                candidate.totalAssigned += 1;
                candidate.assignedByDate[slot.dateKey] = slot.type;
                employeeStates.set(candidateId, candidate);
            }
        }

        // 7c. בדיקת כיסוי — אם יש חסר, הוסף אזהרה
        if (assignedEmployeeIds.length < slot.requiredHeadcount) {
            const dayLabel = slot.date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
            const shiftLabel: Record<ShiftType, string> = { morning: 'בוקר', afternoon: 'צהריים', night: 'לילה' };
            warnings.push(
                `משמרת ${shiftLabel[slot.type]} בתאריך ${dayLabel} — ${slot.requiredHeadcount - assignedEmployeeIds.length} עובד חסר (${assignedEmployeeIds.length}/${slot.requiredHeadcount})`,
            );
        }

        assignedShifts.push({
            date: slot.date,
            type: slot.type,
            employees: assignedEmployeeIds,
        });
    }

    return { shifts: assignedShifts, warnings };
}
