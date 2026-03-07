/**
 * Utility functions for week management using Israeli convention (Sunday-Saturday)
 */

/**
 * Gets the ISO week ID for a given date.
 * ISO week in this project: week starts on Sunday.
 * weekId "2026-W11" means it contains the ISO week 11 of 2026.
 */
export function getWeekId(dateToCheck = new Date()): string {
    // To align with standard ISO week calculation methods while treating Sunday as the first day,
    // we shift Sunday to Monday just for the calculation of the year and week number.
    const date = new Date(dateToCheck.getTime());
    date.setHours(0, 0, 0, 0);

    if (date.getDay() === 0) {
        date.setDate(date.getDate() + 1); // Shift Sunday -> Monday
    }

    // Standard ISO week calculation (Thursday is the middle of the week)
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    const year = date.getFullYear();

    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Returns e.g. "2026-W11" for current week
 */
export function getCurrentWeekId(): string {
    return getWeekId(new Date());
}

/**
 * Returns array of 7 Dates (Sun-Sat) for that week
 */
export function getWeekDates(weekId: string): Date[] {
    const match = weekId.match(/^(\d{4})-W(\d{2})$/);
    if (!match) throw new Error("Invalid weekId format. Expected YYYY-Www");

    const year = parseInt(match[1]);
    const week = parseInt(match[2]);

    // Find Jan 4th of the year (always in ISO week 1)
    const jan4 = new Date(year, 0, 4);
    jan4.setHours(0, 0, 0, 0);

    // Find the Monday of week 1
    const day = (jan4.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
    const mondayOfWeek1 = new Date(jan4.getTime());
    mondayOfWeek1.setDate(jan4.getDate() - day);

    // Find Monday of the target week
    const mondayOfTargetWeek = new Date(mondayOfWeek1.getTime());
    mondayOfTargetWeek.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);

    // In our Israeli convention, the week starts on the Sunday BEFORE this Monday.
    const sunday = new Date(mondayOfTargetWeek.getTime());
    sunday.setDate(mondayOfTargetWeek.getDate() - 1);

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(sunday.getTime());
        d.setDate(sunday.getDate() + i);
        dates.push(d);
    }

    return dates;
}

/**
 * Returns Monday 23:59 of that week
 */
export function getDeadline(weekId: string): Date {
    const dates = getWeekDates(weekId);
    // dates[0] is Sunday, dates[1] is Monday
    const monday = new Date(dates[1].getTime());
    monday.setHours(23, 59, 59, 999);
    return monday;
}

/**
 * isDeadlinePassed(weekId: string): boolean
 */
export function isDeadlinePassed(weekId: string): boolean {
    return new Date().getTime() > getDeadline(weekId).getTime();
}
