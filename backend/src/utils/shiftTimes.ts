// ─── Shift Time Constants & Partial Impact Utilities ─────────────────────────

export type ShiftType = 'morning' | 'afternoon' | 'night';

export interface ShiftWindow {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    durationMinutes: number;
}

export const SHIFT_WINDOWS: Record<ShiftType, ShiftWindow> = {
    morning:   { startHour: 6,  startMinute: 45, endHour: 14, endMinute: 45, durationMinutes: 480 },
    afternoon: { startHour: 14, startMinute: 45, endHour: 22, endMinute: 45, durationMinutes: 480 },
    night:     { startHour: 22, startMinute: 45, endHour: 6,  endMinute: 45, durationMinutes: 480 },
};

/** Block threshold: missing >= 50% of an 8-hour shift = 4 hours = 240 minutes */
export const BLOCK_THRESHOLD_MINUTES = 240;

export interface PartialImpactResult {
    missingMinutes: number;
    gapDescription: string;   // e.g. "06:45–10:00" or "06:45–10:00 & 13:00–14:45"
    action: 'cover_start' | 'cover_end';
    shouldBlock: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Converts "HH:MM" to minutes from midnight. */
function parseToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

/** Formats minutes-from-midnight back to "HH:MM". Handles values > 1440 (wraps). */
function formatMinutes(totalMinutes: number): string {
    const normalised = totalMinutes % 1440;
    const h = Math.floor(normalised / 60);
    const m = normalised % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns the effective minutes value for a time string within a shift's window.
 * For night shifts (which wrap past midnight), times before the shift's start
 * hour are in the "next day" portion of the shift, so 1440 is added so that
 * arithmetic works correctly on a linear scale.
 */
function effectiveMinutes(timeMinutes: number, shiftStartMinutes: number): number {
    return timeMinutes < shiftStartMinutes ? timeMinutes + 1440 : timeMinutes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculates the partial impact of an employee's time-window constraint on a shift.
 *
 * Returns null when neither `availableFrom` nor `availableTo` is set (no partial
 * constraint exists). The caller should treat null as "fully available".
 *
 * For night shifts (22:45–06:45) the function accounts for the midnight wrap by
 * normalising all times onto a continuous linear scale before doing arithmetic.
 *
 * @param shiftType    The shift being checked.
 * @param availableFrom  "HH:MM" — earliest time the employee can start.  null = shift start.
 * @param availableTo    "HH:MM" — latest time the employee can stay.     null = shift end.
 */
export function calculatePartialImpact(
    shiftType: ShiftType,
    availableFrom?: string | null,
    availableTo?: string | null,
): PartialImpactResult | null {
    if (!availableFrom && !availableTo) return null;

    const window = SHIFT_WINDOWS[shiftType];
    const isNight = window.endHour < window.startHour; // shifts wrapping past midnight

    const shiftStartMinutes = window.startHour * 60 + window.startMinute;
    // For night shift, the "true" end is 06:45 + 1440 on the linear scale.
    const rawEndMinutes = window.endHour * 60 + window.endMinute;
    const shiftEndMinutes = isNight ? rawEndMinutes + 1440 : rawEndMinutes;

    let startGapMinutes = 0;
    let endGapMinutes = 0;
    let startGapDesc = '';
    let endGapDesc = '';

    if (availableFrom) {
        const fromRaw = parseToMinutes(availableFrom);
        const fromEff = effectiveMinutes(fromRaw, shiftStartMinutes);
        startGapMinutes = Math.max(0, fromEff - shiftStartMinutes);
        if (startGapMinutes > 0) {
            startGapDesc = `${formatMinutes(shiftStartMinutes)}–${formatMinutes(fromEff)}`;
        }
    }

    if (availableTo) {
        const toRaw = parseToMinutes(availableTo);
        const toEff = effectiveMinutes(toRaw, shiftStartMinutes);
        endGapMinutes = Math.max(0, shiftEndMinutes - toEff);
        if (endGapMinutes > 0) {
            endGapDesc = `${formatMinutes(toEff)}–${formatMinutes(shiftEndMinutes)}`;
        }
    }

    const missingMinutes = startGapMinutes + endGapMinutes;

    // No actual gap — the time windows don't cut into the shift at all.
    if (missingMinutes === 0) return null;

    const gapDescription =
        startGapDesc && endGapDesc
            ? `${startGapDesc} & ${endGapDesc}`
            : startGapDesc || endGapDesc;

    const action: PartialImpactResult['action'] =
        endGapMinutes > startGapMinutes ? 'cover_end' : 'cover_start';

    return {
        missingMinutes,
        gapDescription,
        action,
        shouldBlock: missingMinutes >= BLOCK_THRESHOLD_MINUTES,
    };
}
