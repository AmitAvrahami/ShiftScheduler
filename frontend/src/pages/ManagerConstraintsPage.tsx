import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { adminAPI, notificationAPI, constraintAPI } from '../lib/api';
import { 
    getCurrentWeekId, 
    getWeekDates, 
    getWeekId, 
    getWeekNumber, 
    formatWeekDateRange, 
    getPreviousWeekId 
} from '../utils/weekUtils';

const toDateKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAYS_HEBREW_SHORT = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];
const DAYS_HEBREW = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const SHIFTS_HEBREW = ['בוקר', 'אתה"צ', 'לילה'];
const SHIFT_KEYS = ['morning', 'afternoon', 'night'];

function daysSinceSunday(weekId: string): number {
    const weekStart = getWeekDates(weekId)[0]; // Sunday of that week
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = today.getTime() - weekStart.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

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
    const [isCopying, setIsCopying] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const [activeTab, setActiveTab] = useState<'submitted' | 'pending' | 'all'>('pending');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [reminderToasts, setReminderToasts] = useState<Record<string, boolean>>({});

    const [editTarget, setEditTarget] = useState<DisplayRow | null>(null);
    const [editGrid, setEditGrid] = useState<
        Array<{ dateKey: string; date: string; shift: string; canWork: boolean }>
    >([]);
    const [isSavingOverride, setIsSavingOverride] = useState(false);

    useEffect(() => {
        try {
            setDates(getWeekDates(weekId));
        } catch (e) {
            console.error(e);
        }
    }, [weekId]);

    const fetchWeekConstraints = useCallback(async () => {
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
    }, [weekId]);

    useEffect(() => {
        fetchWeekConstraints();
    }, [weekId, fetchWeekConstraints]);

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

    const handleCopyFromPreviousWeek = async () => {
        const previousWeekId = getPreviousWeekId(weekId);
        if (!window.confirm(`האם ברצונך להעתיק את האילוצים מ${previousWeekId} לשבוע זה (${weekId})? אילוצים קיימים יוחלפו.`)) {
            return;
        }

        setIsCopying(true);
        setMessage(null);
        try {
            const res = await adminAPI.copyConstraintsFromPreviousWeek(previousWeekId, weekId);
            if (res.data.success) {
                setMessage({ text: res.data.message, type: 'success' });
                await fetchWeekConstraints();
            } else {
                setMessage({ text: res.data.message || 'שגיאה בהעתקת האילוצים', type: 'error' });
            }
        } catch (error) {
            console.error('Copy error:', error);
            setMessage({ text: 'שגיאה בהעתקת האילוצים', type: 'error' });
        } finally {
            setIsCopying(false);
        }
    };

    const handleSendReminder = async (employeeId: string) => {
        try {
            await notificationAPI.create({
                employeeId,
                type: 'reminder',
                message: `תזכורת: יש להגיש אילוצים לשבוע ${weekId}`
            });

            setReminderToasts(prev => ({ ...prev, [employeeId]: true }));
            setTimeout(() => {
                setReminderToasts(prev => ({ ...prev, [employeeId]: false }));
            }, 3000);

        } catch (error) {
            console.error('Reminder error:', error);
            setMessage({ text: 'שגיאה בשליחת תזכורת', type: 'error' });
        }
    };

    const openEditModal = (row: DisplayRow) => {
        const weekDates = getWeekDates(weekId);
        const grid = weekDates.flatMap(date => {
            const dateKey = toDateKey(date);
            return SHIFT_KEYS.map(shift => {
                const existing = row.constraints.find(
                    c => toDateKey(new Date(c.date)) === dateKey && c.shift === shift
                );
                return {
                    dateKey,
                    date: dateKey + 'T00:00:00.000Z',
                    shift,
                    canWork: existing ? existing.canWork : true,
                };
            });
        });
        setEditGrid(grid);
        setEditTarget(row);
    };

    const toggleCell = (dateKey: string, shift: string) => {
        setEditGrid(prev => prev.map(cell =>
            cell.dateKey === dateKey && cell.shift === shift
                ? { ...cell, canWork: !cell.canWork }
                : cell
        ));
    };

    const handleSaveOverride = async () => {
        if (!editTarget) return;
        setIsSavingOverride(true);
        try {
            const payload = editGrid
                .filter(cell => cell.canWork === false)
                .map(cell => ({
                    date: cell.date,
                    shift: cell.shift as 'morning' | 'afternoon' | 'night',
                    canWork: false as const,
                    availableFrom: null,
                    availableTo: null,
                }));
            await constraintAPI.managerOverride(editTarget.key, weekId, payload);
            setMessage({ text: 'האילוצים עודכנו בהצלחה ✓', type: 'success' });
            setEditTarget(null);
            await fetchWeekConstraints();
        } catch (error) {
            console.error('Override error:', error);
            setMessage({ text: 'שגיאה בעדכון האילוצים', type: 'error' });
        } finally {
            setIsSavingOverride(false);
        }
    };

    const submittedRows = displayRows.filter(r => r.constraints.length > 0);
    const pendingRows = displayRows.filter(r => r.constraints.length === 0);

    let visibleRows: DisplayRow[] = [];
    if (activeTab === 'submitted') visibleRows = submittedRows;
    else if (activeTab === 'pending') visibleRows = pendingRows;
    else visibleRows = displayRows;

    const hasAnyConstraints = displayRows.some(r => r.constraints.length > 0);
    const isCurrentWeekLocked = hasAnyConstraints && displayRows.some(r => r.isLocked);

    const selectedRow = displayRows.find(r => r.key === selectedEmployeeId);

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6" dir="rtl">
            {/* Header section */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">הגבלות זמינות</h1>
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${isCurrentWeekLocked ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {isCurrentWeekLocked ? 'נעול' : 'טיוטה'}
                        </span>
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                        שבוע {getWeekNumber(weekId)}, תאריכים: {formatWeekDateRange(weekId)}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Copy Previous Week + Week Navigation */}
                    <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                        <button
                            onClick={handlePrevWeek}
                            className="p-2 hover:bg-slate-50 text-slate-500 transition-colors border-l border-slate-200"
                            title="שבוע קודם"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="px-4 py-1.5 text-sm font-medium text-slate-700">
                            שבוע {getWeekNumber(weekId)}
                        </div>
                        <button
                            onClick={handleNextWeek}
                            className="p-2 hover:bg-slate-50 text-slate-500 transition-colors border-r border-slate-200"
                            title="שבוע הבא"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>

                    <button
                        onClick={handleCopyFromPreviousWeek}
                        disabled={isCopying || isLoading}
                        className="px-4 py-2 font-medium rounded-lg border border-slate-200 shadow-sm transition-colors flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        title="העתק משבוע קודם"
                    >
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        העתק קודם
                    </button>

                    <button className="px-4 py-2 font-medium rounded-lg border border-slate-200 shadow-sm transition-colors flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-50">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        יצוא לדוח
                    </button>
                    
                    {isCurrentWeekLocked ? (
                        <>
                            <button disabled className="px-4 py-2 font-medium rounded-lg shadow-sm flex items-center gap-2 bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed">
                                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                נעול
                            </button>
                            <button onClick={handleUnlock} disabled={isUnlocking} className="px-4 py-2 font-medium rounded-lg border border-slate-300 shadow-sm transition-colors flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                בטל נעילה
                            </button>
                        </>
                    ) : (
                        <button onClick={handleLock} disabled={isLocking || !hasAnyConstraints} className="px-4 py-2 font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50">
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                            {isLocking ? 'נועל...' : 'נעל הגבלות'}
                        </button>
                    )}
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-lg border flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-6">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`pb-4 px-6 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 relative -mb-[1px] ${activeTab === 'pending' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    בהמתנה ({pendingRows.length})
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <button
                    onClick={() => setActiveTab('submitted')}
                    className={`pb-4 px-6 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 relative -mb-[1px] ${activeTab === 'submitted' ? 'border-green-500 text-green-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    עובדים שהגישו ({submittedRows.length})
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    className={`pb-4 px-6 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 relative -mb-[1px] ${activeTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    כל הגבלות
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Right Panel (Employee Cards) - in RTL this displays on the right naturally */}
                <div className="flex-1 flex flex-col gap-4">
                    {isLoading ? (
                        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">טוען נתונים...</div>
                    ) : visibleRows.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                            לא נמצאו רשומות מתאימות
                        </div>
                    ) : (
                        visibleRows.map((row) => {
                            const isSubmitted = row.constraints.length > 0;
                            const lateDays = daysSinceSunday(weekId);

                            return (
                                <div 
                                    key={row.key} 
                                    className={`flex items-center justify-between p-5 bg-white rounded-xl shadow-sm transition-all hover:shadow-md border ${isSubmitted ? 'border-slate-200 border-r-4 border-r-green-400' : 'border-slate-200'} ${selectedEmployeeId === row.key ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">{row.user.name}</h3>
                                            <div className="text-sm mt-0.5">
                                                {isSubmitted ? (
                                                    <span className="text-slate-500">הוגש בהצלחה</span>
                                                ) : (
                                                    <span className="text-amber-600 font-medium flex items-center gap-1.5">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                        באיחור של {lateDays} ימים
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        {isSubmitted ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setSelectedEmployeeId(row.key)}
                                                    className={`px-5 py-2 text-sm font-semibold rounded-lg border transition-colors ${selectedEmployeeId === row.key ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                                                >
                                                    צפה בפרטים
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(row)}
                                                    className="px-5 py-2 text-sm font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                                >
                                                    ערוך אילוצים
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                {reminderToasts[row.key] && (
                                                    <span className="text-blue-600 text-sm font-medium animate-pulse">תזכורת נשלחה ✓</span>
                                                )}
                                                <button
                                                    onClick={() => handleSendReminder(row.key)}
                                                    className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                                >
                                                    שלח תזכורת
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(row)}
                                                    className="px-5 py-2 text-sm font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                                >
                                                    ערוך אילוצים
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Left Panel (Mini Grid Preview) */}
                <div className="w-full lg:w-[340px] shrink-0">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sticky top-6">
                        {selectedRow ? (
                            <>
                                <div className="flex items-center gap-2 mb-6 text-blue-800">
                                    <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                    <h2 className="font-bold text-lg">תצוגת זמינות: {selectedRow.user.name}</h2>
                                </div>

                                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
                                    {/* Header Row (Days) */}
                                    <div className="col-start-2 grid grid-cols-7 gap-1.5 text-center mb-1">
                                        {DAYS_HEBREW.map((day, i) => (
                                            <div key={i} className="text-xs font-semibold text-slate-500">{day}'</div>
                                        ))}
                                    </div>

                                    {/* Rows (Shifts) */}
                                    {SHIFT_KEYS.map((shift, shiftIndex) => (
                                        <div key={shift} className="contents">
                                            <div className="text-xs font-medium text-slate-500 self-center whitespace-nowrap pt-1">
                                                {SHIFTS_HEBREW[shiftIndex]}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1.5">
                                                {dates.map((date, dateIndex) => {
                                                    const dateStr = toDateKey(date);
                                                    const entry = selectedRow.constraints.find(c =>
                                                        toDateKey(new Date(c.date)) === dateStr && c.shift === shift
                                                    );

                                                    let bgColor = 'bg-slate-50 border-slate-100'; // Default, no constraint -> maybe free
                                                    if (!entry) {
                                                        bgColor = 'bg-stone-50 border-stone-200'; // Should be available/green, but wait: the prompt said if no entry -> available. Let's make it green-100 or stone-50.
                                                        // Prompt says: "no constraint = free (canWork true) -> Green bg-green-100"
                                                        bgColor = 'bg-green-100 border-green-200';
                                                    } else if (entry.canWork === false) {
                                                        bgColor = 'bg-orange-100 border-orange-200';
                                                    } else if (entry.canWork === true && (entry.availableFrom || entry.availableTo)) {
                                                        bgColor = 'bg-purple-100 border-purple-200';
                                                    } else if (entry.canWork === true) {
                                                        bgColor = 'bg-green-100 border-green-200';
                                                    }

                                                    return (
                                                        <div
                                                            key={dateIndex}
                                                            className={`h-8 rounded ${bgColor} border`}
                                                            title={entry && entry.canWork && (entry.availableFrom || entry.availableTo) ? `מ-${entry.availableFrom || '*'} עד ${entry.availableTo || '*'}` : undefined}
                                                        ></div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100 space-y-3 text-xs font-medium text-slate-600">
                                    <div className="flex items-center justify-end gap-3">
                                        <span>זמין למשמרת</span>
                                        <div className="w-5 h-5 rounded bg-green-100 border border-green-200"></div>
                                    </div>
                                    <div className="flex items-center justify-end gap-3">
                                        <span>זמין חלקית</span>
                                        <div className="w-5 h-5 rounded bg-purple-100 border border-purple-200"></div>
                                    </div>
                                    <div className="flex items-center justify-end gap-3">
                                        <span>לא זמין / חופש</span>
                                        <div className="w-5 h-5 rounded bg-orange-100 border border-orange-200"></div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-48 flex flex-col justify-center items-center text-slate-400">
                                <span>בחר עובד כדי לצפות בזמינות</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        {/* Edit Constraints Modal */}
        {editTarget && (
            <div
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                onClick={() => setEditTarget(null)}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl"
                    onClick={e => e.stopPropagation()}
                    dir="rtl"
                >
                    {/* Modal Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-800">
                            עריכת אילוצים — {editTarget.user.name}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            שבוע {getWeekNumber(weekId)} | {formatWeekDateRange(weekId)}
                        </p>
                    </div>

                    {/* Modal Grid */}
                    <div className="px-6 py-5">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                            {/* Day headers */}
                            <div></div>
                            <div className="grid grid-cols-7 gap-1.5 text-center mb-1">
                                {DAYS_HEBREW.map((day, i) => (
                                    <div key={i} className="text-xs font-semibold text-slate-500">{day}'</div>
                                ))}
                            </div>

                            {/* Shift rows */}
                            {SHIFT_KEYS.map((shift, shiftIndex) => (
                                <div key={shift} className="contents">
                                    <div className="text-xs font-medium text-slate-500 self-center whitespace-nowrap">
                                        {SHIFTS_HEBREW[shiftIndex]}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {dates.map((date) => {
                                            const dateKey = toDateKey(date);
                                            const cell = editGrid.find(
                                                c => c.dateKey === dateKey && c.shift === shift
                                            );
                                            const available = cell ? cell.canWork : true;
                                            return (
                                                <button
                                                    key={dateKey}
                                                    onClick={() => toggleCell(dateKey, shift)}
                                                    className={`h-10 rounded text-xs font-semibold border transition-colors ${
                                                        available
                                                            ? 'bg-green-100 border-green-200 text-green-800 hover:bg-green-200'
                                                            : 'bg-red-100 border-red-200 text-red-800 hover:bg-red-200'
                                                    }`}
                                                >
                                                    {available ? 'זמין' : 'חסום'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 pb-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                        <button
                            onClick={() => setEditTarget(null)}
                            className="px-5 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                        >
                            ביטול
                        </button>
                        <button
                            onClick={handleSaveOverride}
                            disabled={isSavingOverride}
                            className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
                        >
                            {isSavingOverride ? 'שומר...' : 'שמור שינויים'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </div>
    );
}
