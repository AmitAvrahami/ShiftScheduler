import {
    getCurrentWeekId,
    getWeekDates,
    getDeadline,
    isDeadlinePassed,
} from '../weekUtils';

describe('weekUtils (Backend)', () => {
    describe('getCurrentWeekId', () => {
        it('returns a string matching format /^\d{4}-W\d{2}$/', () => {
            const weekId = getCurrentWeekId();
            expect(weekId).toMatch(/^\d{4}-W\d{2}$/);
        });

        it('returns the correct weekId for a known date', () => {
            // Mock current date
            jest.useFakeTimers().setSystemTime(new Date('2024-03-01T12:00:00Z')); // Friday, week 09
            expect(getCurrentWeekId()).toBe('2024-W09');

            jest.useFakeTimers().setSystemTime(new Date('2024-01-01T12:00:00Z')); // Monday, week 01
            expect(getCurrentWeekId()).toBe('2024-W01');

            jest.useRealTimers();
        });
    });

    describe('getWeekDates', () => {
        it('returns array of exactly 7 dates', () => {
            const dates = getWeekDates('2024-W10');
            expect(dates).toHaveLength(7);
        });

        it('first date is Sunday and last is Saturday', () => {
            const dates = getWeekDates('2024-W10');
            expect(dates[0].getDay()).toBe(0); // Sunday
            expect(dates[6].getDay()).toBe(6); // Saturday
        });

        it('dates are correct for a known weekId (2024-W10)', () => {
            // 2024-W10 is March 3 to March 9
            const dates = getWeekDates('2024-W10');
            expect(dates[0].getFullYear()).toBe(2024);
            expect(dates[0].getMonth()).toBe(2); // March is 2 (0-indexed)
            expect(dates[0].getDate()).toBe(3);

            expect(dates[6].getFullYear()).toBe(2024);
            expect(dates[6].getMonth()).toBe(2);
            expect(dates[6].getDate()).toBe(9);
        });
    });

    describe('getDeadline', () => {
        it('returns a Date that is Monday 23:59', () => {
            const deadline = getDeadline('2024-W10');
            expect(deadline.getDay()).toBe(1); // Monday
            expect(deadline.getHours()).toBe(23);
            expect(deadline.getMinutes()).toBe(59);
            expect(deadline.getSeconds()).toBe(59);
            expect(deadline.getMilliseconds()).toBe(999);
        });

        it('the Monday belongs to the correct week', () => {
            const deadline = getDeadline('2024-W10');
            // For 2024-W10 (Mar 3 - Mar 9), deadline is Monday Mar 4
            expect(deadline.getFullYear()).toBe(2024);
            expect(deadline.getMonth()).toBe(2);
            expect(deadline.getDate()).toBe(4);
        });
    });

    describe('isDeadlinePassed', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        it('returns true for a past week', () => {
            jest.useFakeTimers().setSystemTime(new Date('2024-04-01T12:00:00Z'));
            expect(isDeadlinePassed('2024-W10')).toBe(true);
        });

        it('returns false for a future week', () => {
            jest.useFakeTimers().setSystemTime(new Date('2024-02-01T12:00:00Z'));
            expect(isDeadlinePassed('2024-W10')).toBe(false);
        });

        it('returns false if today is Monday before 23:59 (edge case)', () => {
            // Deadline is Mar 4 at 23:59:59.999
            jest.useFakeTimers().setSystemTime(new Date(2024, 2, 4, 23, 58, 0));
            expect(isDeadlinePassed('2024-W10')).toBe(false);

            jest.useFakeTimers().setSystemTime(new Date(2024, 2, 5, 0, 0, 0));
            expect(isDeadlinePassed('2024-W10')).toBe(true);
        });
    });
});
