import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { getCurrentWeekId, getWeekDates, getWeekId, getWeekNumber, formatWeekDateRange } from '../utils/weekUtils';

const toDateKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAYS_HEBREW = [
    'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'
];

interface ConstraintEntry {
    date: string;
    shift: string;
    canWork: boolean;
    availableFrom?: string | null;
    availableTo?: string | null;
}

interface ActiveUser {
    _id: string;
    name: string;
    email: string;
    role: string;
    isFixedMorning?: boolean;
    isActive: boolean;
}

interface EmployeeConstraint {
    _id: string;
    userId: ActiveUser;
    weekId: string;
    constraints: ConstraintEntry[];
    isLocked: boolean;
}

interface DisplayRow {
    key: string;
    user: ActiveUser;
    constraints: ConstraintEntry[];
    isLocked: boolean;
}

export default function ManagerConstraintsPage() {
    const [weekId, setWeekId] = useState<string>(getCurrentWeekId());
    const [dates, setDates] = useState<Date[]>([]);
    const [displayRows, setDisplayRows] = useState<DisplayRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLocking, setIsLocking] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        try {
            setDates(getWeekDates(weekId));
        } catch (e) {
            console.error(e);
        }
    }, [weekId]);

    useEffect(() => {
        fetchWeekConstraints();
    }, [weekId]);

    const fetchWeekConstraints = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const [constraintsRes, usersRes] = await Promise.all([
                api.get(`/constraints/week/${weekId}`),
                api.get('/users')
            ]);

            const validConstraints: EmployeeConstraint[] = constraintsRes.data.success
                ? constraintsRes.data.data.filter(
                    (c: EmployeeConstraint) => c.userId && c.userId.isActive
                )
                : [];

            const activeUsers: ActiveUser[] = usersRes.data.success
                ? usersRes.data.data
                : [];

            const constraintMap = new Map<string, EmployeeConstraint>();
            for (const ec of validConstraints) {
                constraintMap.set(ec.userId._id, ec);
            }

            const rows: DisplayRow[] = activeUsers.map(u => {
                const ec = constraintMap.get(u._id);
                return {
                    key: u._id,
                    user: ec ? ec.userId : u,
                    constraints: ec ? ec.constraints : [],
                    isLocked: ec ? ec.isLocked : false,
                };
            });

            setDisplayRows(rows);
        } catch (error) {
            console.error('Failed to fetch week constraints', error);
            setMessage({ text: 'שגיאה בטעינת אילוצי העובדים', type: 'error' });
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

    const handleLock = async () => {
        if (!window.confirm(`האם אתה בטוח שברצונך לנעול את האילוצים לשבוע ${getWeekNumber(weekId)} (${formatWeekDateRange(weekId)})? לאחר הנעילה, עובדים לא יוכלו לשנות את האילוצים שלהם.`)) {
            return;
        }

        setIsLocking(true);
        try {
            const res = await api.patch(`/constraints/lock/${weekId}`);
            if (res.data.success) {
                setMessage({ text: `האילוצים ננעלו בהצלחה (${res.data.lockedCount} רשומות)`, type: 'success' });
                setDisplayRows(prev => prev.map(row => ({ ...row, isLocked: true })));
            }
        } catch (error) {
            console.error('Lock error:', error);
            setMessage({ text: 'שגיאה בנעילת האילוצים', type: 'error' });
        } finally {
            setIsLocking(false);
        }
    };

    const handleUnlock = async () => {
        if (!window.confirm(`האם לבטל את נעילת האילוצים לשבוע ${getWeekNumber(weekId)} (${formatWeekDateRange(weekId)})? עובדים יוכלו לשנות את האילוצים שלהם שוב.`)) {
            return;
        }

        setIsUnlocking(true);
        try {
            const res = await api.patch(`/constraints/unlock/${weekId}`);
            if (res.data.success) {
                setMessage({ text: 'הנעילה הוסרה — עובדים יכולים כעת לעדכן אילוצים', type: 'success' });
                setDisplayRows(prev => prev.map(row => ({ ...row, isLocked: false })));
            }
        } catch (error) {
            console.error('Unlock error:', error);
            setMessage({ text: 'שגיאה בביטול נעילת האילוצים', type: 'error' });
        } finally {
            setIsUnlocking(false);
        }
    };

    const SHIFT_LABEL: Record<string, string> = { morning: 'בוקר', afternoon: 'צהריים', night: 'לילה' };

    const renderCellBadges = (constraints: ConstraintEntry[], dateStr: string) => {
        const fullBlocks = constraints.filter(
            c => toDateKey(new Date(c.date)) === dateStr && !c.canWork
        );
        const partialConstraints = constraints.filter(
            c => toDateKey(new Date(c.date)) === dateStr && c.canWork && (c.availableFrom || c.availableTo)
        );

        if (fullBlocks.length === 0 && partialConstraints.length === 0) {
            return <span className="text-green-500 text-xl font-bold">✓</span>;
        }

        return (
            <div className="flex flex-col gap-1 items-center">
                {fullBlocks.map((c, i) => {
                    let badgeColor = 'bg-slate-200 text-slate-800';
                    if (c.shift === 'morning') badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                    else if (c.shift === 'afternoon') badgeColor = 'bg-orange-100 text-orange-800 border-orange-200';
                    else if (c.shift === 'night') badgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
                    return (
                        <span key={`full-${i}`} className={`text-xs px-2 py-0.5 rounded-full border ${badgeColor}`}>
                            {SHIFT_LABEL[c.shift] ?? c.shift}
                        </span>
                    );
                })}
                {partialConstraints.map((c, i) => {
                    const timeNote = c.availableFrom
                        ? `מ-${c.availableFrom}`
                        : `עד ${c.availableTo}`;
                    return (
                        <span key={`partial-${i}`} className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                            {SHIFT_LABEL[c.shift] ?? c.shift} | {timeNote}
                        </span>
                    );
                })}
            </div>
        );
    };

    const hasAnyConstraints = displayRows.some(r => r.constraints.length > 0);
    const isCurrentWeekLocked = hasAnyConstraints && displayRows.some(r => r.isLocked);

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
                    &rarr; חזרה ללוח הבקרה
                </Link>
                <h1 className="text-2xl font-bold text-slate-800">
                    אילוצי עובדים — שבוע {getWeekNumber(weekId)}
                    <span className="text-base font-normal text-slate-500 mr-2">{formatWeekDateRange(weekId)}</span>
                </h1>

                <div className="flex items-center space-x-2 space-x-reverse bg-white rounded-lg shadow-sm border border-slate-200 p-1">
                    <button
                        onClick={handleNextWeek}
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
                        className="p-2 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                        title="שבוע קודם"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {isCurrentWeekLocked ? (
                        <>
                            {/* Locked status indicator */}
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-sm font-medium">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                האילוצים ננעלו
                            </div>
                            {/* Unlock button */}
                            <button
                                onClick={handleUnlock}
                                disabled={isUnlocking}
                                className="px-4 py-2 font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors flex items-center gap-2 bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 016 0h2a5 5 0 00-5-5z" /></svg>
                                {isUnlocking ? 'מבטל נעילה...' : 'בטל נעילה'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleLock}
                            disabled={isLocking || !hasAnyConstraints}
                            className="px-4 py-2 font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLocking ? 'נועל...' : 'נעל אילוצים'}
                        </button>
                    )}
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-semibold w-48 sticky right-0 bg-slate-50 z-10 border-l border-slate-200">
                                    שם העובד
                                </th>
                                {dates.map((date, index) => (
                                    <th key={index} scope="col" className="px-4 py-4 text-center border-l border-slate-200 last:border-0 min-w-[100px]">
                                        <div className="font-semibold text-slate-800">{DAYS_HEBREW[index]}</div>
                                        <div className="text-slate-500 text-xs mt-1">{`${date.getDate()}/${date.getMonth() + 1}`}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-slate-500">טוען נתונים...</td>
                                </tr>
                            ) : displayRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                                        לא נמצאו עובדים פעילים
                                    </td>
                                </tr>
                            ) : (
                                displayRows.map((row) => (
                                    <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-200 shadow-[inset_-1px_0_0_0_rgb(226,232,240)]">
                                            <div className="flex flex-col">
                                                <span>{row.user.name}</span>
                                                {row.user.role === 'manager' && (
                                                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 w-fit mt-1">
                                                        מנהל
                                                    </span>
                                                )}
                                                {row.user.isFixedMorning && (
                                                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 w-fit mt-1">
                                                        קבוע בוקר
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {dates.map((date, index) => {
                                            const dateStr = toDateKey(date);
                                            return (
                                                <td key={index} className="px-4 py-3 text-center align-middle border-l border-slate-200 last:border-0 bg-white">
                                                    <div className="min-h-[60px] flex items-center justify-center">
                                                        {renderCellBadges(row.constraints, dateStr)}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
