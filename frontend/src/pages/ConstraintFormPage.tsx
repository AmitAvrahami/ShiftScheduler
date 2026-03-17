import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { getCurrentWeekId, getWeekDates, getWeekId, getWeekNumber, formatWeekDateRange } from '../utils/weekUtils';
import { useAuthStore } from '../store/authStore';

const SHIFTS = [
    { id: 'morning', label: 'בוקר' },
    { id: 'afternoon', label: 'צהריים' },
    { id: 'night', label: 'לילה' }
];

const DAYS_HEBREW = [
    'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'
];

const toDateKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface ConstraintEntry {
    date: string; // ISO string
    shift: string;
    canWork: boolean;
    availableFrom?: string | null;
    availableTo?: string | null;
}

export default function ConstraintFormPage() {
    const { user } = useAuthStore();
    const isManager = user?.role === 'manager';
    const [weekId, setWeekId] = useState<string>(getCurrentWeekId());
    const [dates, setDates] = useState<Date[]>([]);
    const [constraints, setConstraints] = useState<ConstraintEntry[]>([]);
    const [partialExpanded, setPartialExpanded] = useState<Record<string, boolean>>({});
    const [isLocked, setIsLocked] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        try {
            setDates(getWeekDates(weekId));
        } catch (e) {
            console.error(e);
        }
    }, [weekId]);

    useEffect(() => {
        fetchMyConstraints();
    }, [weekId]);

    const fetchMyConstraints = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/constraints/my/${weekId}`);

            if (res.data.data) {
                const mapped = res.data.data.constraints.map((c: any) => ({
                    date: toDateKey(new Date(c.date)),
                    shift: c.shift,
                    canWork: c.canWork,
                    availableFrom: c.availableFrom ?? null,
                    availableTo: c.availableTo ?? null,
                }));
                setConstraints(mapped);
                // Auto-expand partial time forms for entries that already have partial times
                const expanded: Record<string, boolean> = {};
                mapped.forEach((c: ConstraintEntry) => {
                    if (c.canWork && (c.availableFrom || c.availableTo)) {
                        expanded[`${c.date}_${c.shift}`] = true;
                    }
                });
                setPartialExpanded(expanded);
                setIsLocked(res.data.data.isLocked);
            } else {
                setConstraints([]);
                setPartialExpanded({});
                setIsLocked(false);
            }
        } catch (error) {
            console.error('Failed to fetch constraints', error);
            setMessage({ text: 'שגיאה בטעינת אילוצים', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevWeek = () => {
        if (dates.length > 0) {
            const prevSunday = new Date(dates[0].getTime() - 7 * 24 * 60 * 60 * 1000);
            setWeekId(getWeekId(prevSunday));
        }
    };

    const handleNextWeek = () => {
        if (dates.length > 0) {
            const nextSunday = new Date(dates[0].getTime() + 7 * 24 * 60 * 60 * 1000);
            setWeekId(getWeekId(nextSunday));
        }
    };

    // The week is considered past once Saturday end-of-day has passed
    const isPastWeek = dates.length > 0 && (() => {
        const saturdayEnd = new Date(dates[6]);
        saturdayEnd.setHours(23, 59, 59, 999);
        return new Date() > saturdayEnd;
    })();

    const readOnly = isLocked || isPastWeek;

    const handleToggle = (dateStr: string, shiftId: string) => {
        if (readOnly) return;
        const key = `${dateStr}_${shiftId}`;
        setConstraints(prev => {
            const existsIndex = prev.findIndex(c => c.date === dateStr && c.shift === shiftId);
            if (existsIndex >= 0) {
                // Unchecking blocked — remove the entry entirely
                return prev.filter((_, i) => i !== existsIndex);
            } else {
                // Checking blocked — remove any partial entry first, then add blocked
                const withoutPartial = prev.filter(c => !(c.date === dateStr && c.shift === shiftId));
                return [...withoutPartial, { date: dateStr, shift: shiftId, canWork: false }];
            }
        });
        // Collapse partial form when marking as fully blocked
        setPartialExpanded(prev => ({ ...prev, [key]: false }));
    };

    const togglePartial = (dateStr: string, shiftId: string) => {
        if (readOnly) return;
        const key = `${dateStr}_${shiftId}`;
        const isOpen = partialExpanded[key];
        if (isOpen) {
            // Closing — clear partial time fields and remove entry if it becomes empty
            setConstraints(prev =>
                prev
                    .map(c => c.date === dateStr && c.shift === shiftId
                        ? { ...c, availableFrom: null, availableTo: null }
                        : c)
                    .filter(c => !(c.date === dateStr && c.shift === shiftId && c.canWork))
            );
        }
        setPartialExpanded(prev => ({ ...prev, [key]: !isOpen }));
    };

    const handlePartialTime = (dateStr: string, shiftId: string, field: 'availableFrom' | 'availableTo', value: string) => {
        if (readOnly) return;
        const timeValue = value || null;
        setConstraints(prev => {
            const existsIndex = prev.findIndex(c => c.date === dateStr && c.shift === shiftId);
            if (existsIndex >= 0) {
                return prev.map((c, i) => i === existsIndex ? { ...c, [field]: timeValue } : c);
            }
            // No entry yet — create a canWork: true partial entry
            return [...prev, { date: dateStr, shift: shiftId, canWork: true, [field]: timeValue }];
        });
    };

    const isChecked = (dateStr: string, shiftId: string) => {
        return constraints.some(c => c.date === dateStr && c.shift === shiftId && !c.canWork);
    };

    const getPartialEntry = (dateStr: string, shiftId: string) =>
        constraints.find(c => c.date === dateStr && c.shift === shiftId && c.canWork);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;

        setIsLoading(true);
        setMessage(null);
        try {
            const meaningfulConstraints = constraints
                .filter(c => !c.canWork || c.availableFrom || c.availableTo)
                .map(c => ({ ...c, date: new Date(c.date) }));
            await api.post('/constraints', { weekId, constraints: meaningfulConstraints });
            setMessage({ text: 'האילוצים נשלחו בהצלחה', type: 'success' });
        } catch (error: any) {
            console.error('Submit error:', error);
            setMessage({
                text: error.response?.data?.message || 'שגיאה בשמירת האילוצים',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium mb-2 md:mb-0">
                    &rarr; חזרה ללוח הבקרה
                </Link>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">הגשת אילוצים לשבוע</h1>
                    <div className="flex items-center space-x-2 space-x-reverse bg-white rounded-lg shadow-sm border border-slate-200 p-1">
                        <button
                            onClick={handleNextWeek}
                            type="button"
                            className="p-2 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                            title="שבוע הבא"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <span className="inline-flex flex-col items-center px-4 min-w-[150px]">
                            <span className="font-semibold text-slate-700 text-sm">שבוע {getWeekNumber(weekId)}</span>
                            <span className="text-xs text-slate-400">{formatWeekDateRange(weekId)}</span>
                        </span>
                        <button
                            onClick={handlePrevWeek}
                            type="button"
                            className="p-2 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                            title="שבוע קודם"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {isLocked && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center space-x-2 space-x-reverse">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">האילוצים ננעלו על ידי המנהל — לא ניתן לערוך</span>
                </div>
            )}

            {isPastWeek && !isLocked && (
                <div className="bg-slate-100 border border-slate-300 text-slate-600 p-4 rounded-lg flex items-center space-x-2 space-x-reverse">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">לא ניתן להגיש אילוצים לשבוע שעבר</span>
                </div>
            )}

            {message && (
                <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {message.text}
                </div>
            )}

            {isLoading && dates.length === 0 ? (
                <div className="text-center py-10">טוען...</div>
            ) : (
                <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <p className="text-sm text-slate-600">
                            {isManager
                                ? <>סמן ימים בהם <span className="font-bold text-red-600">לא תוכלי לעבוד</span>. הבחירה חוסמת אוטומטית את משמרת הבוקר.</>
                                : <>סמן את המשמרות בהן <span className="font-bold text-red-600">לא תוכל/י</span> לעבוד.</>
                            }
                        </p>
                    </div>
                    <div className="divide-y divide-slate-200">
                        {dates.map((date, index) => {
                            const dateStr = toDateKey(date);
                            const dayName = DAYS_HEBREW[index];
                            const dateLabel = `${date.getDate()}/${date.getMonth() + 1}`;

                            if (isManager) {
                                const checked = isChecked(dateStr, 'morning');
                                return (
                                    <label
                                        key={dateStr}
                                        className={`flex items-center justify-between p-4 md:p-6 cursor-pointer hover:bg-slate-50 transition-colors ${readOnly ? 'cursor-not-allowed' : ''}`}
                                    >
                                        <div>
                                            <div className="font-semibold text-slate-800">{dayName}</div>
                                            <div className="text-sm text-slate-500">{dateLabel}</div>
                                        </div>
                                        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-all ${checked ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'} ${readOnly ? 'opacity-70' : ''}`}>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 text-red-500 border-slate-300 rounded focus:ring-red-400 focus:ring-offset-2"
                                                checked={checked}
                                                onChange={() => handleToggle(dateStr, 'morning')}
                                                disabled={readOnly}
                                            />
                                            <span className={checked ? 'text-red-700 font-medium' : 'text-slate-600'}>
                                                {checked ? 'לא עובדת' : 'פנויה'}
                                            </span>
                                        </div>
                                    </label>
                                );
                            }

                            return (
                                <div key={dateStr} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center hover:bg-slate-50 transition-colors">
                                    <div className="md:w-1/4 mb-4 md:mb-0">
                                        <div className="font-semibold text-slate-800">{dayName}</div>
                                        <div className="text-sm text-slate-500">{dateLabel}</div>
                                    </div>

                                    <div className="md:w-3/4 flex flex-col gap-3">
                                        {SHIFTS.map(shift => {
                                            const checked = isChecked(dateStr, shift.id);
                                            const key = `${dateStr}_${shift.id}`;
                                            const isExpanded = !!partialExpanded[key];
                                            const partialEntry = getPartialEntry(dateStr, shift.id);
                                            return (
                                                <div
                                                    key={shift.id}
                                                    className={`flex flex-col p-3 rounded-lg border transition-all ${checked
                                                        ? 'border-red-400 bg-red-50'
                                                        : isExpanded
                                                            ? 'border-amber-400 bg-amber-50'
                                                            : 'border-slate-200 bg-white'
                                                        } ${readOnly ? 'opacity-70' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            className="w-5 h-5 text-red-500 border-slate-300 rounded focus:ring-red-400 focus:ring-offset-2 flex-shrink-0"
                                                            checked={checked}
                                                            onChange={() => handleToggle(dateStr, shift.id)}
                                                            disabled={readOnly}
                                                            title="לא יכול/ה לעבוד כלל"
                                                        />
                                                        <span className={`font-medium ${checked ? 'text-red-700 line-through' : 'text-slate-700'}`}>
                                                            {shift.label}
                                                        </span>
                                                        {!checked && !readOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={() => togglePartial(dateStr, shift.id)}
                                                                className={`mr-auto text-xs px-2 py-1 rounded border transition-colors ${isExpanded
                                                                    ? 'border-amber-400 text-amber-700 bg-amber-100 hover:bg-amber-200'
                                                                    : 'border-slate-300 text-slate-500 bg-white hover:bg-slate-100'}`}
                                                            >
                                                                {isExpanded ? 'ביטול שעות ▲' : 'קבע שעות חלקיות ▾'}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {isExpanded && !checked && (
                                                        <div className="mt-3 pt-3 border-t border-amber-200 flex flex-wrap gap-4 text-sm">
                                                            <label className="flex flex-col gap-1 text-slate-700">
                                                                <span className="text-xs font-medium text-amber-700">זמין/ה החל מ:</span>
                                                                <input
                                                                    type="time"
                                                                    value={partialEntry?.availableFrom ?? ''}
                                                                    onChange={e => handlePartialTime(dateStr, shift.id, 'availableFrom', e.target.value)}
                                                                    disabled={readOnly}
                                                                    className="border border-amber-300 rounded px-2 py-1 text-sm focus:ring-amber-400 focus:border-amber-400"
                                                                />
                                                            </label>
                                                            <label className="flex flex-col gap-1 text-slate-700">
                                                                <span className="text-xs font-medium text-amber-700">זמין/ה עד:</span>
                                                                <input
                                                                    type="time"
                                                                    value={partialEntry?.availableTo ?? ''}
                                                                    onChange={e => handlePartialTime(dateStr, shift.id, 'availableTo', e.target.value)}
                                                                    disabled={readOnly}
                                                                    className="border border-amber-300 rounded px-2 py-1 text-sm focus:ring-amber-400 focus:border-amber-400"
                                                                />
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading || readOnly}
                            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? 'שומר...' : 'שלח אילוצים'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
