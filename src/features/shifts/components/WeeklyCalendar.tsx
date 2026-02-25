import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import type { Employee, Role, Shift } from '../../../types';
import { useLanguage } from '../../../i18n/LanguageContext';

interface WeeklyCalendarProps {
    currentDate: Date;
    shifts: Shift[];
    employees: Employee[];
    roles: Role[];
}

/**
 * Weekly calendar grid showing employees on rows and weekdays as columns.
 * Shift cards are colour-coded by role. The "Employee" header and "Target"
 * sub-label are translated via the active language strategy.
 */
export function WeeklyCalendar({ currentDate, shifts, employees, roles }: WeeklyCalendarProps) {
    const { t } = useLanguage();
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday start
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

    /**
     * Gets the hex colour for a given role id.
     * @param roleId - Firestore role document id
     */
    const getRoleColor = (roleId: string) =>
        roles.find((r) => r.id === roleId)?.color_code || '#cbd5e1';

    /**
     * Gets the display title for a given role id.
     * @param roleId - Firestore role document id
     */
    const getRoleName = (roleId: string) =>
        roles.find((r) => r.id === roleId)?.title || 'Unknown';

    return (
        <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header Row: Days of the week */}
            <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50/50">
                {/* "Employee" column header */}
                <div className="p-4 flex items-center justify-center font-medium text-gray-500 border-e border-gray-200">
                    {t('calendar.employee')}
                </div>

                {weekDays.map((day) => (
                    <div
                        key={day.toISOString()}
                        className="p-4 flex flex-col items-center justify-center border-e border-gray-200 last:border-0"
                    >
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {format(day, 'EEE')}
                        </span>
                        <span
                            className={`text-lg font-bold mt-1 ${isSameDay(day, new Date()) ? 'text-primary' : 'text-gray-900'
                                }`}
                        >
                            {format(day, 'd')}
                        </span>
                    </div>
                ))}
            </div>

            {/* Grid Body: Employees and their shifts */}
            <div className="flex-1 overflow-y-auto">
                {employees.map((employee) => (
                    <div
                        key={employee.id}
                        className="grid grid-cols-8 border-b border-gray-100 last:border-0 hover:bg-gray-50/30 transition-colors"
                    >
                        {/* Employee info cell */}
                        <div className="p-4 border-e border-gray-200 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                                {employee.first_name[0]}{employee.last_name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-gray-900 truncate">
                                    {employee.first_name} {employee.last_name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                    {t('calendar.targetShifts', {
                                        count: employee.preferences?.target_shifts_per_week ?? 'N/A',
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Day cells */}
                        {weekDays.map((day) => {
                            const dayShifts = shifts.filter(
                                (s) =>
                                    s.employee_id === employee.id &&
                                    isSameDay(new Date(s.start_time), day)
                            );

                            return (
                                <div
                                    key={day.toISOString()}
                                    className="p-2 border-e border-gray-200 last:border-0 min-h-[100px]"
                                >
                                    <div className="space-y-2">
                                        {dayShifts.map((shift) => (
                                            <div
                                                key={shift.id}
                                                className="px-3 py-2 text-xs rounded-md shadow-sm border border-transparent hover:shadow-md transition-shadow cursor-pointer"
                                                style={{
                                                    backgroundColor: `${getRoleColor(shift.role_id)}15`,
                                                    borderColor: `${getRoleColor(shift.role_id)}30`,
                                                    color: getRoleColor(shift.role_id),
                                                }}
                                            >
                                                <div className="font-semibold mb-0.5">
                                                    {format(new Date(shift.start_time), 'HH:mm')} -{' '}
                                                    {format(new Date(shift.end_time), 'HH:mm')}
                                                </div>
                                                <div className="opacity-80 truncate">
                                                    {getRoleName(shift.role_id)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}

                {employees.length === 0 && (
                    <div className="p-12 text-center text-gray-500">{t('calendar.noEmployees')}</div>
                )}
            </div>
        </div>
    );
}
