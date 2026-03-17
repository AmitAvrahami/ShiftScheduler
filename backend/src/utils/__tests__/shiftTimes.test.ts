import { calculatePartialImpact, SHIFT_WINDOWS, BLOCK_THRESHOLD_MINUTES } from '../shiftTimes';

describe('calculatePartialImpact', () => {
    it('returns null when neither availableFrom nor availableTo is set', () => {
        expect(calculatePartialImpact('morning', null, null)).toBeNull();
        expect(calculatePartialImpact('afternoon', undefined, undefined)).toBeNull();
        expect(calculatePartialImpact('night')).toBeNull();
    });

    it('returns null when availableFrom/availableTo do not cut into the shift', () => {
        // availableFrom = shift start → no gap
        expect(calculatePartialImpact('morning', '06:45', null)).toBeNull();
        // availableTo = shift end → no gap
        expect(calculatePartialImpact('afternoon', null, '22:45')).toBeNull();
    });

    describe('morning shift (06:45–14:45)', () => {
        it('availableFrom="10:45" → missingMinutes=240, shouldBlock=true (exactly 50%)', () => {
            const result = calculatePartialImpact('morning', '10:45', null);
            expect(result).not.toBeNull();
            expect(result!.missingMinutes).toBe(240);
            expect(result!.shouldBlock).toBe(true);
            expect(result!.action).toBe('cover_start');
            expect(result!.gapDescription).toBe('06:45–10:45');
        });

        it('availableFrom="10:00" → missingMinutes=195, shouldBlock=false, action=cover_start', () => {
            const result = calculatePartialImpact('morning', '10:00', null);
            expect(result).not.toBeNull();
            // 10:00 - 06:45 = 3h15m = 195 minutes
            expect(result!.missingMinutes).toBe(195);
            expect(result!.shouldBlock).toBe(false);
            expect(result!.action).toBe('cover_start');
        });

        it('availableTo="12:00" → missingMinutes=165, shouldBlock=false, action=cover_end', () => {
            const result = calculatePartialImpact('morning', null, '12:00');
            expect(result).not.toBeNull();
            // 14:45 - 12:00 = 2h45m = 165 minutes
            expect(result!.missingMinutes).toBe(165);
            expect(result!.shouldBlock).toBe(false);
            expect(result!.action).toBe('cover_end');
            expect(result!.gapDescription).toBe('12:00–14:45');
        });

        it('both availableFrom and availableTo → sums gaps', () => {
            // Start gap: 09:00 - 06:45 = 135 min
            // End gap:   14:45 - 13:45 = 60 min
            // Total: 195 min, action=cover_start (start gap is bigger)
            const result = calculatePartialImpact('morning', '09:00', '13:45');
            expect(result).not.toBeNull();
            expect(result!.missingMinutes).toBe(195);
            expect(result!.action).toBe('cover_start');
            expect(result!.gapDescription).toContain('&');
        });
    });

    describe('afternoon shift (14:45–22:45)', () => {
        it('availableTo="20:00" → missingMinutes=165, shouldBlock=false, action=cover_end', () => {
            const result = calculatePartialImpact('afternoon', null, '20:00');
            expect(result).not.toBeNull();
            // 22:45 - 20:00 = 2h45m = 165 minutes
            expect(result!.missingMinutes).toBe(165);
            expect(result!.shouldBlock).toBe(false);
            expect(result!.action).toBe('cover_end');
        });

        it('availableFrom="18:45" → missingMinutes=240, shouldBlock=true', () => {
            // 18:45 - 14:45 = 4h = 240 minutes → exactly at threshold
            const result = calculatePartialImpact('afternoon', '18:45', null);
            expect(result).not.toBeNull();
            expect(result!.missingMinutes).toBe(240);
            expect(result!.shouldBlock).toBe(true);
        });
    });

    describe('night shift (22:45–06:45 next day) — midnight-wrap arithmetic', () => {
        it('availableFrom="00:00" → correctly computes start gap across midnight', () => {
            // Shift start: 22:45 = 1365 min
            // 00:00 = 0 min → effective = 0 + 1440 = 1440 min
            // Gap = 1440 - 1365 = 75 minutes
            const result = calculatePartialImpact('night', '00:00', null);
            expect(result).not.toBeNull();
            expect(result!.missingMinutes).toBe(75);
            expect(result!.shouldBlock).toBe(false);
            expect(result!.action).toBe('cover_start');
        });

        it('availableFrom="02:45" → missingMinutes=240, shouldBlock=true', () => {
            // 02:45 effective = 2*60+45 + 1440 = 1605 min
            // Gap = 1605 - 1365 = 240 min → exactly at threshold
            const result = calculatePartialImpact('night', '02:45', null);
            expect(result).not.toBeNull();
            expect(result!.missingMinutes).toBe(240);
            expect(result!.shouldBlock).toBe(true);
        });

        it('availableTo="05:00" → correctly computes end gap (time before 22:45)', () => {
            // Shift end effective: 06:45 + 1440 = 1845 min
            // 05:00 effective = 5*60 + 1440 = 1740 min
            // End gap = 1845 - 1740 = 105 minutes
            const result = calculatePartialImpact('night', null, '05:00');
            expect(result).not.toBeNull();
            expect(result!.missingMinutes).toBe(105);
            expect(result!.shouldBlock).toBe(false);
            expect(result!.action).toBe('cover_end');
        });
    });

    describe('BLOCK_THRESHOLD_MINUTES constant', () => {
        it('equals 240 (50% of an 8-hour shift)', () => {
            expect(BLOCK_THRESHOLD_MINUTES).toBe(240);
        });
    });

    describe('SHIFT_WINDOWS', () => {
        it('all shifts are exactly 8 hours (480 minutes)', () => {
            expect(SHIFT_WINDOWS.morning.durationMinutes).toBe(480);
            expect(SHIFT_WINDOWS.afternoon.durationMinutes).toBe(480);
            expect(SHIFT_WINDOWS.night.durationMinutes).toBe(480);
        });
    });
});
