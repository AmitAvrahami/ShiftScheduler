import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { scheduleAPI } from '../lib/api';
import { getCurrentWeekId, getWeekDates, getWeekId, getWeekNumber, formatWeekDateRange } from '../utils/weekUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeBasic {
    _id: string;
    name: string;
}

interface ShiftCard {
    date: string;
    type: 'morning' | 'afternoon' | 'night';
    employees: EmployeeBasic[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_LABELS: Record<string, string> = {
    morning: 'בוקר',
    afternoon: 'צהריים',
    night: 'לילה',
};

/** Tailwind color classes per shift type */
const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
    morning: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200', badge: 'bg-blue-500' },
    afternoon: { bg: 'bg-orange-50', text: 'text-orange-900', border: 'border-orange-200', badge: 'bg-orange-500' },
    night: { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-200', badge: 'bg-purple-600' },
};

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Employee page showing only the shifts the logged-in user is assigned to.
 *
 * Features:
 * - Week selector (prev/next)
 * - Color-coded shift cards: בוקר=blue, צהריים=orange, לילה=purple
 * - Empty state and "not published" state
 */
export default function MySchedulePage() {
    const [weekId, setWeekId] = useState<string>(getCurrentWeekId());
    const [weekDates, setWeekDates] = useState<Date[]>([]);
    const [myShifts, setMyShifts] = useState<ShiftCard[]>([]);
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
        loadMyShifts();
    }, [weekId]);

    const loadMyShifts = useCallback(async () => {
        setIsLoading(true);
        setNotPublished(false);
        setNoSchedule(false);
        try {
            const res = await scheduleAPI.getMySchedule(weekId);
            setMyShifts(res.data.data || []);
        } catch (err: any) {
            const status = err.response?.status;
            const message = err.response?.data?.message || '';
            if (status === 404 && message.includes('טרם פורסם')) {
                setNotPublished(true);
            } else if (status === 404) {
                setNoSchedule(true);
            }
            setMyShifts([]);
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

    /**
     * Resolves the Hebrew day name for a given shift date.
     */
    const getDayName = (dateStr: string): string => {
        const date = new Date(dateStr);
        return DAY_NAMES_HE[date.getDay()] ?? '';
    };

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return `${date.getDate()}/${date.getMonth() + 1}`;
    };

    return (
        <div className="min-h-screen bg-gray-50" dir="rtl">
            {/* Header */}
            <nav className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">המשמרות שלי</h1>
                    <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                        → חזרה ללוח הבקרה
                    </Link>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
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
                        <p className="text-lg font-medium text-gray-600">הסידור טרם פורסם לשבוע זה</p>
                        <p className="text-sm text-gray-400 mt-1">בקש מהמנהל לפרסם את הסידור</p>
                    </div>
                ) : noSchedule ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                        <p className="text-lg font-medium text-gray-500">לא קיים סידור לשבוע זה</p>
                    </div>
                ) : myShifts.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-500">אין משמרות לשבוע זה</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myShifts.map((shift, idx) => {
                            const colors = SHIFT_COLORS[shift.type];
                            return (
                                <div
                                    key={idx}
                                    className={`${colors.bg} ${colors.border} border rounded-xl p-5 shadow-sm`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className={`text-lg font-bold ${colors.text}`}>
                                                יום {getDayName(shift.date)}
                                            </p>
                                            <p className="text-sm text-gray-500">{formatDate(shift.date)}</p>
                                        </div>
                                        <span className={`${colors.badge} text-white text-xs font-semibold px-3 py-1 rounded-full`}>
                                            {SHIFT_LABELS[shift.type]}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {shift.employees.map(e => e.name).join(', ')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
