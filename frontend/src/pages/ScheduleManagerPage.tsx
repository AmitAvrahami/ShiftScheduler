import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { scheduleAPI } from '../lib/api';
import { getCurrentWeekId, getWeekDates, getWeekId } from '../utils/weekUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeBasic {
    _id: string;
    name: string;
}

interface ShiftData {
    _id?: string;
    date: string;
    type: 'morning' | 'afternoon' | 'night';
    employees: EmployeeBasic[];
}

interface ScheduleData {
    _id: string;
    weekStartDate: string;
    shifts: ShiftData[];
    isPublished: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_LABELS: Record<'morning' | 'afternoon' | 'night', string> = {
    morning: 'בוקר',
    afternoon: 'צהריים',
    night: 'לילה',
};

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

type ShiftType = 'morning' | 'afternoon' | 'night';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Manager-only page for generating and publishing the weekly schedule.
 *
 * Features:
 * - Week selector (prev/next)
 * - "צור סידור" — generates a draft schedule via the algorithm
 * - Schedule table: rows=shifts (בוקר/צהריים/לילה), columns=days (ראשון-שבת)
 * - Understaffed cells highlighted in red
 * - Warnings list
 * - "פרסם סידור" — publishes the schedule with confirmation dialog
 */
export default function ScheduleManagerPage() {
    const [weekId, setWeekId] = useState<string>(getCurrentWeekId());
    const [weekDates, setWeekDates] = useState<Date[]>([]);
    const [schedule, setSchedule] = useState<ScheduleData | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [isLoadingExisting, setIsLoadingExisting] = useState(false);

    // Compute dates when weekId changes
    useEffect(() => {
        try {
            setWeekDates(getWeekDates(weekId));
        } catch (e) {
            console.error('Invalid weekId:', e);
        }
    }, [weekId]);

    // Load existing schedule for the selected week
    useEffect(() => {
        loadExistingSchedule();
    }, [weekId]);

    const loadExistingSchedule = useCallback(async () => {
        setIsLoadingExisting(true);
        try {
            const res = await scheduleAPI.getSchedule(weekId);
            setSchedule(res.data.data);
            setWarnings([]);
        } catch (err: any) {
            // 404 is normal — no schedule yet for this week
            if (err.response?.status !== 404) {
                console.error('Error loading schedule:', err);
            }
            setSchedule(null);
            setWarnings([]);
        } finally {
            setIsLoadingExisting(false);
        }
    }, [weekId]);

    const showToast = (text: string, type: 'success' | 'error') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4000);
    };

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

    const handleGenerate = async () => {
        setIsGenerating(true);
        setWarnings([]);
        try {
            const res = await scheduleAPI.generate(weekId);
            setSchedule(res.data.data.schedule);
            setWarnings(res.data.data.warnings || []);
            showToast('הסידור נוצר בהצלחה!', 'success');
        } catch (err: any) {
            const message = err.response?.data?.message || 'שגיאה ביצירת הסידור';
            showToast(message, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePublish = async () => {
        setShowConfirm(false);
        setIsPublishing(true);
        try {
            const res = await scheduleAPI.publish(weekId);
            setSchedule(res.data.data);
            showToast('הסידור פורסם בהצלחה לכל העובדים!', 'success');
        } catch (err: any) {
            const message = err.response?.data?.message || 'שגיאה בפרסום הסידור';
            showToast(message, 'error');
        } finally {
            setIsPublishing(false);
        }
    };

    // ─── Table helpers ─────────────────────────────────────────────────────────

    /**
     * Returns the employees assigned to the specified shift on the specified day index.
     * Also returns whether this shift slot is understaffed.
     */
    const getCellData = (dayIndex: number, shiftType: ShiftType) => {
        if (!schedule || !weekDates[dayIndex]) return { employees: [], isUnderstaffed: false };

        const dayDate = weekDates[dayIndex];
        const dayDateKey = dayDate.toISOString().split('T')[0];

        const shift = schedule.shifts.find(s => {
            const shiftDateKey = new Date(s.date).toISOString().split('T')[0];
            return shiftDateKey === dayDateKey && s.type === shiftType;
        });

        const employees = shift?.employees ?? [];

        // Determine required count based on day/type (mirrors backend rules)
        const dayOfWeek = dayDate.getDay();
        let required = 1;
        if (dayOfWeek !== 5 && dayOfWeek !== 6) {
            // Weekday
            required = shiftType === 'night' ? 1 : 2;
        } else if (dayOfWeek === 5) {
            // Friday
            required = shiftType === 'morning' ? 2 : 1;
        }

        return { employees, isUnderstaffed: employees.length < required };
    };

    const isPublished = schedule?.isPublished ?? false;
    const hasSchedule = !!schedule;

    return (
        <div className="min-h-screen bg-gray-50" dir="rtl">
            {/* Header */}
            <nav className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">ניהול סידור עבודה</h1>
                    <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                        → חזרה ללוח הבקרה
                    </Link>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                {/* Week Selector & Action Buttons */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Week Selector */}
                    <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
                        <button
                            onClick={handleNextWeek}
                            className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="שבוע הבא"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <span className="font-semibold px-4 text-gray-700 min-w-[130px] text-center">{weekId}</span>
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

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || isPublished || isLoadingExisting}
                            className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isGenerating ? 'יוצר...' : 'צור סידור'}
                        </button>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={!hasSchedule || isPublished || isPublishing || isLoadingExisting}
                            className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isPublishing ? 'מפרסם...' : 'פרסם סידור'}
                        </button>
                    </div>
                </div>

                {/* Published badge */}
                {isPublished && (
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium">הסידור פורסם לעובדים</span>
                    </div>
                )}

                {/* Warnings */}
                {warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1">
                        <p className="font-semibold text-amber-800 mb-2">⚠ אזהרות:</p>
                        {warnings.map((w, i) => (
                            <p key={i} className="text-sm text-amber-700">{w}</p>
                        ))}
                    </div>
                )}

                {/* Schedule Table */}
                {isLoadingExisting ? (
                    <div className="text-center py-16 text-gray-400">טוען...</div>
                ) : !hasSchedule ? (
                    <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-500">לא נוצר סידור לשבוע זה</p>
                        <p className="text-sm text-gray-400 mt-1">לחץ על "צור סידור" כדי להתחיל</p>
                    </div>
                ) : (
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
                                            const { employees: emps, isUnderstaffed } = getCellData(dayIdx, shiftType);
                                            return (
                                                <td
                                                    key={dayIdx}
                                                    className={`py-2 px-2 align-top ${isUnderstaffed ? 'bg-red-50' : ''}`}
                                                >
                                                    {isUnderstaffed && (
                                                        <div className="flex items-center justify-center gap-1 text-red-600 text-xs mb-1">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            <span>חסר</span>
                                                        </div>
                                                    )}
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
                )}
            </main>

            {/* Confirmation Dialog */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" dir="rtl">
                        <h2 className="text-lg font-bold text-gray-800">פרסום סידור עבודה</h2>
                        <p className="text-gray-600 text-sm">
                            האם לפרסם את הסידור לעובדים? לאחר הפרסום לא ניתן לשנות את הסידור.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handlePublish}
                                className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                            >
                                כן, פרסם
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg text-white font-medium z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.text}
                </div>
            )}
        </div>
    );
}
