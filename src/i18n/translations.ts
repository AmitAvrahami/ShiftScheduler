/**
 * @fileoverview Internationalization (i18n) translations dictionary.
 *
 * This module implements the **Strategy Pattern** for multi-language support.
 * Each language is a "strategy" (a flat key-value map). The `useLanguage()` hook
 * selects the active strategy at runtime.
 *
 * Supported languages:
 * - `en` — English (LTR)
 * - `he` — Hebrew  (RTL)
 *
 * @example
 * const { t } = useLanguage();
 * <h1>{t('dashboard.title')}</h1>
 */

export type LanguageCode = 'en' | 'he';

/** Direction mapping per language */
export const LANGUAGE_DIRECTIONS: Record<LanguageCode, 'ltr' | 'rtl'> = {
    en: 'ltr',
    he: 'rtl',
};

/** Human-readable label for the language selector */
export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
    en: 'English',
    he: 'עברית',
};

/** A flat key → translated-string map  */
export type TranslationMap = Record<string, string>;

/**
 * The master translation dictionary.
 * Keys follow dot-notation grouping: `section.key`.
 * Add new strings here first, then use `t('section.key')` in components.
 */
const translations: Record<LanguageCode, TranslationMap> = {
    // ─── English ───────────────────────────────────────────────────────────
    en: {
        // App / Brand
        'app.name': 'ShiftAgent',

        // Navigation
        'nav.schedule': 'Schedule',
        'nav.shifts': 'Shifts',
        'nav.team': 'Team',
        'nav.settings': 'Settings',
        'nav.logout': 'Logout',

        // Header
        'header.searchPlaceholder': 'Search shifts, employees...',
        'header.adminUser': 'Admin User',
        'header.manager': 'Manager',

        // Dashboard
        'dashboard.title': 'Weekly Schedule',
        'dashboard.subtitle': 'Manage shifts and employee schedules',
        'dashboard.seedMockData': 'Seed Mock Data',
        'dashboard.generateDraft': 'Generate Draft',
        'dashboard.generating': 'Generating...',
        'dashboard.addShift': 'Add Shift',
        'dashboard.noActiveEmployees': 'No active employees',
        'dashboard.noActiveEmployeesDescription':
            'You need to add employees before you can schedule shifts.',
        'dashboard.loadingSchedule': 'Loading schedule...',
        'dashboard.errorTitle': 'Error Loading Dashboard',
        'dashboard.seedDataError': 'Failed to seed data. Make sure Firestore rules allow writes.',
        'dashboard.scheduleGenerated':
            'Schedule generated! {hardViolations} hard violations. Penalty score: {penaltyScore}',
        'dashboard.appliedAssignments': 'Applied {count} new shift assignments.',
        'dashboard.noNewAssignments': 'No new assignments were made.',
        'dashboard.generateFailed': 'Failed to generate draft schedule.',

        // Weekly Calendar
        'calendar.employee': 'Employee',
        'calendar.shift': 'Shift',
        'calendar.noEmployees': 'No employees added yet.',
        'calendar.targetShifts': 'Target: {count} shifts',

        // Shift Modal
        'shiftModal.title': 'Add New Shift',
        'shiftModal.shiftType': 'Shift Type',
        'shiftModal.morning': 'Morning',
        'shiftModal.afternoon': 'Afternoon',
        'shiftModal.night': 'Night',
        'shiftModal.employee': 'Employee',
        'shiftModal.selectEmployee': 'Select an employee...',
        'shiftModal.role': 'Role',
        'shiftModal.selectRole': 'Select a role...',
        'shiftModal.date': 'Date',
        'shiftModal.startTime': 'Start Time',
        'shiftModal.endTime': 'End Time',
        'shiftModal.notes': 'Notes (Optional)',
        'shiftModal.notesPlaceholder': 'Add any specific instructions...',
        'shiftModal.cancel': 'Cancel',
        'shiftModal.saveShift': 'Save Shift',
        'shiftModal.shiftCreated': 'Shift created successfully!',
        'shiftModal.shiftFailed': 'Failed to create shift.',
        'shiftModal.validation.employeeRequired': 'Employee is required',
        'shiftModal.validation.roleRequired': 'Role is required',
        'shiftModal.validation.dateRequired': 'Date is required',
        'shiftModal.validation.startTimeRequired': 'Start time is required',
        'shiftModal.validation.endTimeRequired': 'End time is required',
        'shiftModal.validation.endAfterStart': 'End time must be after start time',

        // Team Page
        'team.title': 'Team Directory',
        'team.subtitle': 'Manage employees, constraints, and work preferences',
        'team.addEmployee': 'Add Employee',
        'team.tableEmployee': 'Employee',
        'team.tableContact': 'Contact',
        'team.tableRoles': 'Roles',
        'team.tableSettings': 'Settings',
        'team.tableActions': 'Actions',
        'team.noEmployees': 'No employees found. Add your first employee to get started!',
        'team.targetShifts': '{count} target shifts',
        'team.constraints': '{count} constraints',
        'team.editTooltip': 'Edit',
        'team.deleteTooltip': 'Delete',
        'team.confirmDelete': 'Are you sure you want to delete this employee?',
        'team.updatedSuccess': 'Employee updated successfully',
        'team.createdSuccess': 'Employee created successfully',
        'team.saveFailed': 'Failed to save employee',
        'team.deletedSuccess': 'Employee deleted successfully',
        'team.deleteFailed': 'Failed to delete employee',

        // Employee Modal
        'employeeModal.addTitle': 'Add New Employee',
        'employeeModal.editTitle': 'Edit Employee',
        'employeeModal.personalInfo': 'Personal Info',
        'employeeModal.firstName': 'First Name',
        'employeeModal.lastName': 'Last Name',
        'employeeModal.email': 'Email',
        'employeeModal.phoneNumber': 'Phone Number',
        'employeeModal.roles': 'Roles',
        'employeeModal.assignedRoles': 'Assigned Roles (Multi-select via Cmd/Ctrl + click)',
        'employeeModal.shiftPreferences': 'Shift Preferences',
        'employeeModal.targetShifts': 'Target Shifts / Wk',
        'employeeModal.minShifts': 'Min Shifts / Wk',
        'employeeModal.maxShifts': 'Max Shifts / Wk',
        'employeeModal.weeklyConstraints': 'Weekly Constraints',
        'employeeModal.addConstraint': 'Add Constraint',
        'employeeModal.noConstraints': 'No constraints added.',
        'employeeModal.constraintType': 'Type',
        'employeeModal.constraintDay': 'Day',
        'employeeModal.partOfDay': 'Part of Day',
        'employeeModal.startTimeOpt': 'Start Time (Opt)',
        'employeeModal.endTimeOpt': 'End Time (Opt)',
        'employeeModal.description': 'Description',
        'employeeModal.descriptionPlaceholder': 'e.g. Basketball practice',
        'employeeModal.cancel': 'Cancel',
        'employeeModal.saveEmployee': 'Save Employee',
        // Constraint types
        'employeeModal.mandatory_unavailability': 'Mandatory Unavailability',
        'employeeModal.preferred': 'Preferred',
        'employeeModal.less_preferred': 'Less Preferred',
        // Parts of day
        'employeeModal.all_day': 'All Day',
        'employeeModal.morning': 'Morning',
        'employeeModal.afternoon': 'Afternoon',
        'employeeModal.evening': 'Evening',
        'employeeModal.night': 'Night',
        // Validation
        'employeeModal.validation.firstNameRequired': 'First name is required',
        'employeeModal.validation.lastNameRequired': 'Last name is required',
        'employeeModal.validation.emailInvalid': 'Invalid email address',
        'employeeModal.validation.phoneRequired': 'Phone number is required',
        'employeeModal.validation.roleRequired': 'At least one role is required',
        'employeeModal.validation.mustBePositive': 'Must be positive',
        'employeeModal.validation.minAtLeastOne': 'Must be at least 1',
        'employeeModal.validation.minNotGreaterThanMax': 'Min shifts cannot be greater than max shifts',
        'employeeModal.validation.endAfterStart': 'End time must be after start time',

        // Days of week
        'day.0': 'Sunday',
        'day.1': 'Monday',
        'day.2': 'Tuesday',
        'day.3': 'Wednesday',
        'day.4': 'Thursday',
        'day.5': 'Friday',
        'day.6': 'Saturday',

        // Language Selector
        'language.select': 'Language',

        // Schedule Demo
        'scheduleDemo.title': 'Shift Schedule Demo',
        'scheduleDemo.subtitle': 'Week of March 1–7, 2026',
        'scheduleDemo.employees': '{count} employees',
        'scheduleDemo.shifts': '{count} shifts',
        'scheduleDemo.totalSlots': '{count} total slots',
        'scheduleDemo.saveFirebase': '🔥 Save to Firebase',
        'scheduleDemo.saving': '⏳ Saving...',
        'scheduleDemo.savedFirebase': '✅ Saved to Firebase',
        'scheduleDemo.errorRetry': '❌ Error — Retry',
        'scheduleDemo.runAlgorithm': '🚀 Run Scheduling Algorithm',
        'scheduleDemo.rerunAlgorithm': '🔄 Re-run Algorithm',
        'scheduleDemo.running': '⏳ Running Algorithm...',
        'scheduleDemo.targetLabel': 'target {count}',
        'scheduleDemo.morningOnly': 'Morning only',
        'scheduleDemo.noNightExcMon': 'No night (exc. Mon)',
        'scheduleDemo.max3Shifts': 'Max 3 shifts',
        'scheduleDemo.archived': 'Archived (Miluim)',
        'scheduleDemo.sarcasticTitle': '😅 Sarcastic Fallback Triggered',
        'scheduleDemo.sarcasticSubtitle': 'Algorithm exhausted all iterations. Hard constraints could not be fully satisfied.',
        'scheduleDemo.perfectTitle': '✅ Perfect Schedule Found!',
        'scheduleDemo.softViolationsTitle': '📊 Valid Schedule with Soft Violations',
        'scheduleDemo.penaltyInfo': 'Penalty score: {score} · Computed in {elapsed}ms',
        'scheduleDemo.overLimit': '↑ over limit',
        'scheduleDemo.underMinimum': '↓ under minimum',
        'scheduleDemo.gridTitle': '📋 Schedule Grid',
        'scheduleDemo.violationsTitle': '📝 Constraint Violations Summary ({count})',
        'scheduleDemo.noStaff': '⚠ No staff assigned',
        'scheduleDemo.staff': '{filled}/{needed} staff',
        'scheduleDemo.readyTitle': 'Ready to schedule',
        'scheduleDemo.readySubtitle': 'Press Run Scheduling Algorithm to find the optimal assignment for the week',
        'scheduleDemo.readyInfo': 'Simulated Annealing · 15,000 iterations · {employees} employees · {shifts} shifts · {slots} slots',
        'scheduleDemo.morning': '🌅 Morning',
        'scheduleDemo.afternoon': '☀️ Afternoon',
        'scheduleDemo.evening': '🌆 Evening',
        'scheduleDemo.night': '🌙 Night',
        'scheduleDemo.savedMessage': '✅ Saved {employees} employees ({names}) and {shifts} shifts to Firebase!',
    },

    // ─── Hebrew ────────────────────────────────────────────────────────────
    he: {
        // App / Brand
        'app.name': 'ShiftAgent',

        // Navigation
        'nav.schedule': 'לוח משמרות',
        'nav.shifts': 'משמרות',
        'nav.team': 'צוות',
        'nav.settings': 'הגדרות',
        'nav.logout': 'התנתק',

        // Header
        'header.searchPlaceholder': 'חיפוש משמרות, עובדים...',
        'header.adminUser': 'מנהל מערכת',
        'header.manager': 'מנהל',

        // Dashboard
        'dashboard.title': 'לוח שבועי',
        'dashboard.subtitle': 'ניהול משמרות ולוחות זמנים של עובדים',
        'dashboard.seedMockData': 'טען נתוני דמה',
        'dashboard.generateDraft': 'צור טיוטה',
        'dashboard.generating': 'יוצר...',
        'dashboard.addShift': 'הוסף משמרת',
        'dashboard.noActiveEmployees': 'אין עובדים פעילים',
        'dashboard.noActiveEmployeesDescription':
            'יש להוסיף עובדים לפני שניתן לתזמן משמרות.',
        'dashboard.loadingSchedule': 'טוען לוח זמנים...',
        'dashboard.errorTitle': 'שגיאה בטעינת לוח המחוונים',
        'dashboard.seedDataError': 'טעינת נתוני דמה נכשלה. ודא שחוקי Firestore מאפשרים כתיבה.',
        'dashboard.scheduleGenerated':
            'לוח זמנים נוצר! {hardViolations} הפרות קריטיות. ציון עונש: {penaltyScore}',
        'dashboard.appliedAssignments': 'יושמו {count} שיבוצי משמרת חדשים.',
        'dashboard.noNewAssignments': 'לא בוצעו שיבוצים חדשים.',
        'dashboard.generateFailed': 'יצירת טיוטת לוח הזמנים נכשלה.',

        // Weekly Calendar
        'calendar.employee': 'עובד',
        'calendar.shift': 'משמרת',
        'calendar.noEmployees': 'לא הוספו עובדים עדיין.',
        'calendar.targetShifts': 'יעד: {count} משמרות',

        // Shift Modal
        'shiftModal.title': 'הוספת משמרת חדשה',
        'shiftModal.shiftType': 'סוג משמרת',
        'shiftModal.morning': 'בוקר',
        'shiftModal.afternoon': 'צהריים',
        'shiftModal.night': 'לילה',
        'shiftModal.employee': 'עובד',
        'shiftModal.selectEmployee': 'בחר עובד...',
        'shiftModal.role': 'תפקיד',
        'shiftModal.selectRole': 'בחר תפקיד...',
        'shiftModal.date': 'תאריך',
        'shiftModal.startTime': 'שעת התחלה',
        'shiftModal.endTime': 'שעת סיום',
        'shiftModal.notes': 'הערות (אופציונלי)',
        'shiftModal.notesPlaceholder': 'הוסף הוראות ספציפיות...',
        'shiftModal.cancel': 'ביטול',
        'shiftModal.saveShift': 'שמור משמרת',
        'shiftModal.shiftCreated': 'המשמרת נוצרה בהצלחה!',
        'shiftModal.shiftFailed': 'יצירת המשמרת נכשלה.',
        'shiftModal.validation.employeeRequired': 'יש לבחור עובד',
        'shiftModal.validation.roleRequired': 'יש לבחור תפקיד',
        'shiftModal.validation.dateRequired': 'יש להזין תאריך',
        'shiftModal.validation.startTimeRequired': 'יש להזין שעת התחלה',
        'shiftModal.validation.endTimeRequired': 'יש להזין שעת סיום',
        'shiftModal.validation.endAfterStart': 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',

        // Team Page
        'team.title': 'ספריית הצוות',
        'team.subtitle': 'ניהול עובדים, מגבלות והעדפות עבודה',
        'team.addEmployee': 'הוסף עובד',
        'team.tableEmployee': 'עובד',
        'team.tableContact': 'פרטי קשר',
        'team.tableRoles': 'תפקידים',
        'team.tableSettings': 'הגדרות',
        'team.tableActions': 'פעולות',
        'team.noEmployees': 'לא נמצאו עובדים. הוסף את העובד הראשון שלך כדי להתחיל!',
        'team.targetShifts': '{count} משמרות יעד',
        'team.constraints': '{count} מגבלות',
        'team.editTooltip': 'עריכה',
        'team.deleteTooltip': 'מחיקה',
        'team.confirmDelete': 'האם אתה בטוח שברצונך למחוק עובד זה?',
        'team.updatedSuccess': 'העובד עודכן בהצלחה',
        'team.createdSuccess': 'העובד נוצר בהצלחה',
        'team.saveFailed': 'שמירת העובד נכשלה',
        'team.deletedSuccess': 'העובד נמחק בהצלחה',
        'team.deleteFailed': 'מחיקת העובד נכשלה',

        // Employee Modal
        'employeeModal.addTitle': 'הוספת עובד חדש',
        'employeeModal.editTitle': 'עריכת עובד',
        'employeeModal.personalInfo': 'פרטים אישיים',
        'employeeModal.firstName': 'שם פרטי',
        'employeeModal.lastName': 'שם משפחה',
        'employeeModal.email': 'דוא"ל',
        'employeeModal.phoneNumber': 'מספר טלפון',
        'employeeModal.roles': 'תפקידים',
        'employeeModal.assignedRoles': 'תפקידים מוקצים (בחר מרובים עם Cmd/Ctrl + לחיצה)',
        'employeeModal.shiftPreferences': 'העדפות משמרת',
        'employeeModal.targetShifts': 'משמרות יעד לשבוע',
        'employeeModal.minShifts': 'מינימום משמרות לשבוע',
        'employeeModal.maxShifts': 'מקסימום משמרות לשבוע',
        'employeeModal.weeklyConstraints': 'מגבלות שבועיות',
        'employeeModal.addConstraint': 'הוסף מגבלה',
        'employeeModal.noConstraints': 'לא הוספו מגבלות.',
        'employeeModal.constraintType': 'סוג',
        'employeeModal.constraintDay': 'יום',
        'employeeModal.partOfDay': 'חלק ביום',
        'employeeModal.startTimeOpt': 'שעת התחלה (אופ\')',
        'employeeModal.endTimeOpt': 'שעת סיום (אופ\')',
        'employeeModal.description': 'תיאור',
        'employeeModal.descriptionPlaceholder': 'למשל: אימון כדורסל',
        'employeeModal.cancel': 'ביטול',
        'employeeModal.saveEmployee': 'שמור עובד',
        // Constraint types
        'employeeModal.mandatory_unavailability': 'אי-זמינות חובה',
        'employeeModal.preferred': 'מועדף',
        'employeeModal.less_preferred': 'פחות מועדף',
        // Parts of day
        'employeeModal.all_day': 'כל היום',
        'employeeModal.morning': 'בוקר',
        'employeeModal.afternoon': 'צהריים',
        'employeeModal.evening': 'ערב',
        'employeeModal.night': 'לילה',
        // Validation
        'employeeModal.validation.firstNameRequired': 'שם פרטי הוא שדה חובה',
        'employeeModal.validation.lastNameRequired': 'שם משפחה הוא שדה חובה',
        'employeeModal.validation.emailInvalid': 'כתובת דוא"ל לא תקינה',
        'employeeModal.validation.phoneRequired': 'מספר טלפון הוא שדה חובה',
        'employeeModal.validation.roleRequired': 'יש לבחור לפחות תפקיד אחד',
        'employeeModal.validation.mustBePositive': 'חייב להיות חיובי',
        'employeeModal.validation.minAtLeastOne': 'חייב להיות לפחות 1',
        'employeeModal.validation.minNotGreaterThanMax': 'מינימום משמרות לא יכול להיות גדול ממקסימום',
        'employeeModal.validation.endAfterStart': 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',

        // Days of week
        'day.0': 'ראשון',
        'day.1': 'שני',
        'day.2': 'שלישי',
        'day.3': 'רביעי',
        'day.4': 'חמישי',
        'day.5': 'שישי',
        'day.6': 'שבת',

        // Language Selector
        'language.select': 'שפה',

        // Schedule Demo
        'scheduleDemo.title': 'הדגמת לוח משמרות',
        'scheduleDemo.subtitle': 'שבוע 1–7 במרץ, 2026',
        'scheduleDemo.employees': '{count} עובדים',
        'scheduleDemo.shifts': '{count} משמרות',
        'scheduleDemo.totalSlots': '{count} סלוטים סה"כ',
        'scheduleDemo.saveFirebase': '🔥 שמור ב-Firebase',
        'scheduleDemo.saving': '⏳ שומר...',
        'scheduleDemo.savedFirebase': '✅ נשמר ב-Firebase',
        'scheduleDemo.errorRetry': '❌ שגיאה — נסה שוב',
        'scheduleDemo.runAlgorithm': '🚀 הרץ את אלגוריתם השיבוץ',
        'scheduleDemo.rerunAlgorithm': '🔄 הרץ שוב',
        'scheduleDemo.running': '⏳ מריץ את האלגוריתם...',
        'scheduleDemo.targetLabel': 'יעד {count}',
        'scheduleDemo.morningOnly': 'בוקר בלבד',
        'scheduleDemo.noNightExcMon': 'ללא לילה (פרט לשני)',
        'scheduleDemo.max3Shifts': 'מקס 3 משמרות',
        'scheduleDemo.archived': 'בארכיון (מילואים)',
        'scheduleDemo.sarcasticTitle': '😅 הופעל לוח ציני',
        'scheduleDemo.sarcasticSubtitle': 'האלגוריתם מיצה את כל האיטרציות. לא ניתן היה לעמוד בכל האילוצים הקריטיים.',
        'scheduleDemo.perfectTitle': '✅ נמצא לוח מושלם!',
        'scheduleDemo.softViolationsTitle': '📊 לוח תקין עם הפרות קלות',
        'scheduleDemo.penaltyInfo': 'ציון עונש: {score} · חושב ב-{elapsed}ms',
        'scheduleDemo.overLimit': '↑ מעל המגבלה',
        'scheduleDemo.underMinimum': '↓ מתחת למינימום',
        'scheduleDemo.gridTitle': '📋 לוח שיבוצים',
        'scheduleDemo.violationsTitle': '📝 סיכום הפרות אילוצים ({count})',
        'scheduleDemo.noStaff': '⚠ לא שובצו עובדים',
        'scheduleDemo.staff': '{filled}/{needed} עובדים',
        'scheduleDemo.readyTitle': 'מוכן לשיבוץ',
        'scheduleDemo.readySubtitle': 'לחץ על "הרץ את אלגוריתם השיבוץ" כדי למצוא את השיבוץ האופטימלי לשבוע',
        'scheduleDemo.readyInfo': 'סימולציה מבוססת קירור · 15,000 איטרציות · {employees} עובדים · {shifts} משמרות · {slots} סלוטים',
        'scheduleDemo.morning': 'בוקר',
        'scheduleDemo.afternoon': 'צהריים',
        'scheduleDemo.evening': 'ערב',
        'scheduleDemo.night': 'לילה',
        'scheduleDemo.savedMessage': '✅ {employees} עובדים ({names}) ו-{shifts} משמרות נשמרו ב-Firebase!',
    },
};

export default translations;
