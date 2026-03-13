import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { scheduleAPI } from '../lib/api';
import { getCurrentWeekId, getWeekDates, getWeekId, getWeekNumber, formatWeekDateRange } from '../utils/weekUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeBasic {
    _id: string;
    name: string;
}

interface ShiftData {
    date: string;
    type: 'morning' | 'afternoon' | 'night';
    employees: EmployeeBasic[];
}

interface ScheduleData {
    shifts: ShiftData[];
    isPublished: boolean;
}

type ShiftType = 'morning' | 'afternoon' | 'night';

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_LABELS: Record<ShiftType, string> = {
    morning: 'בוקר',
    afternoon: 'צהריים',
    night: 'לילה',
};

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Read-only full schedule view accessible to all authenticated users.
 *
 * Employees see 404 / "not published" state until the manager publishes.
 * The table mirrors the manager view but has no edit capabilities.
 */
export default function ScheduleViewPage() {
    const [weekId, setWeekId] = useState<string>(getCurrentWeekId());
    const [weekDates, setWeekDates] = useState<Date[]>([]);
    const [schedule, setSchedule] = useState<ScheduleData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [notPublished, setNotPublished] = useState(false);
    const [noSchedule, setNoSchedule] = useState(false);

    useEffect(() => {
        try {
            setWeekDates(getWeekDates(weekId));
        } catch (e) {
            console.error(e);
        }
    }, [weekId]);

    useEffect(() => {
        loadSchedule();
    }, [weekId]);

    const loadSchedule = useCallback(async () => {
        setIsLoading(true);
        setNotPublished(false);
        setNoSchedule(false);
        try {
            const res = await scheduleAPI.getSchedule(weekId);
            setSchedule(res.data.data);
        } catch (err: any) {
            const status = err.response?.status;
            const message = err.response?.data?.message || '';
            if (status === 404 && message.includes('טרם פורסם')) {
                setNotPublished(true);
            } else if (status === 404) {
                setNoSchedule(true);
            }
            setSchedule(null);
        } finally {
            setIsLoading(false);
        }
    }, [weekId]);

    const handlePrevWeek = () => {
        if (weekDates.length > 0) {
            const prevSunday = new Date(weekDates[0].getTime() - 7 * 24 * 60 * 60 * 1000);
            setWeekId(getWeekId(prevSunday));
        }
    };

    const handleNextWeek = () => {
        if (weekDates.length > 0) {
            const nextSunday = new Date(weekDates[0].getTime() + 7 * 24 * 60 * 60 * 1000);
            setWeekId(getWeekId(nextSunday));
        }
    };

    const getCellEmployees = (dayIndex: number, shiftType: ShiftType): EmployeeBasic[] => {
        if (!schedule || !weekDates[dayIndex]) return [];
        const dayDateKey = weekDates[dayIndex].toISOString().split('T')[0];
        const shift = schedule.shifts.find(s => {
            const shiftDateKey = new Date(s.date).toISOString().split('T')[0];
            return shiftDateKey === dayDateKey && s.type === shiftType;
        });
        return shift?.employees ?? [];
    };

    return (
        <div className="min-h-screen bg-gray-50" dir="rtl">
            {/* Header */}
            <nav className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">סידור עבודה</h1>
                    <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                        → חזרה ללוח הבקרה
                    </Link>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                {/* Week Selector */}
                <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1 w-fit">
                    <button
                        onClick={handleNextWeek}
                        className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                        title="שבוע הבא"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <span className="inline-flex flex-col items-center px-4 min-w-[150px]">
                        <span className="font-semibold text-gray-700 text-sm">שבוע {getWeekNumber(weekId)}</span>
                        <span className="text-xs text-gray-400">{formatWeekDateRange(weekId)}</span>
                    </span>
                    <button
                        onClick={handlePrevWeek}
                        className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                        title="שבוע קודם"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="text-center py-16 text-gray-400">טוען...</div>
                ) : notPublished ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                        <svg className="w-12 h-12 mx-auto mb-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v.01M12 9v4m0 0v-4m0 4H12M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-600">הסידור טרם פורסם</p>
                    </div>
                ) : noSchedule ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                        <p className="text-lg font-medium text-gray-500">לא קיים סידור לשבוע זה</p>
                    </div>
                ) : schedule ? (
                    <div className="overflow-x-auto bg-white rounded-xl shadow border border-gray-200">
                        <table className="w-full text-sm text-center">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="py-3 px-4 font-semibold text-gray-600 text-right w-24">משמרת</th>
                                    {weekDates.map((date, idx) => (
                                        <th key={idx} className="py-3 px-2 font-semibold text-gray-600">
                                            <div>{DAY_NAMES[idx]}</div>
                                            <div className="text-xs text-gray-400 font-normal">
                                                {date.getDate()}/{date.getMonth() + 1}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(['morning', 'afternoon', 'night'] as ShiftType[]).map(shiftType => (
                                    <tr key={shiftType} className="border-b border-gray-100 last:border-0">
                                        <td className="py-3 px-4 text-right font-semibold text-gray-700">
                                            {SHIFT_LABELS[shiftType]}
                                        </td>
                                        {weekDates.map((_, dayIdx) => {
                                            const emps = getCellEmployees(dayIdx, shiftType);
                                            return (
                                                <td key={dayIdx} className="py-2 px-2 align-top">
                                                    <div className="space-y-0.5">
                                                        {emps.length === 0 ? (
                                                            <span className="text-xs text-gray-300">—</span>
                                                        ) : (
                                                            emps.map((emp, i) => (
                                                                <div key={i} className="text-xs bg-indigo-100 text-indigo-800 rounded px-1.5 py-0.5">
                                                                    {emp.name}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </main>
        </div>
    );
}
