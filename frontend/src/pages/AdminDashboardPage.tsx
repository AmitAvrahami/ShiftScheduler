import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { adminAPI } from '../lib/api';
import { AdminStats } from '../types';
import { getCurrentWeekId, getWeekId, getWeekDates, formatWeekDateRange } from '../utils/weekUtils';

// ─── Local Interfaces ────────────────────────────────────────────────────────

interface AdminUser {
    _id: string;
    name: string;
    email: string;
    role: 'employee' | 'manager' | 'admin';
    isFixedMorning: boolean;
    isActive: boolean;
    createdAt: string;
}

interface UserFormData {
    name: string;
    email: string;
    password: string;
    role: 'employee' | 'manager' | 'admin';
    isFixedMorning: boolean;
    isActive: boolean;
}

interface ConstraintEntry {
    date: string;
    shift: 'morning' | 'afternoon' | 'night';
    canWork: boolean;
    availableFrom?: string | null;
    availableTo?: string | null;
}

interface AdminConstraint {
    _id: string;
    userId: {
        _id: string;
        name: string;
        email: string;
        role: string;
        isActive: boolean;
    };
    weekId: string;
    constraints: ConstraintEntry[];
    isLocked: boolean;
    submittedAt: string;
}

interface AdminSchedule {
    _id: string;
    weekStartDate: string;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
}

interface OverrideFormData {
    userId: string;
    userName: string;
    weekId: string;
    constraints: ConstraintEntry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: UserFormData = {
    name: '',
    email: '',
    password: '',
    role: 'employee',
    isFixedMorning: false,
    isActive: true,
};

const SHIFT_LABELS: Record<string, string> = {
    morning: 'בוקר',
    afternoon: 'צהריים',
    night: 'לילה',
};

const DAY_LABELS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// ─── Helper sub-components ────────────────────────────────────────────────────

function StatCard({ label, value, color, loading }: { label: string; value: string | number; color: string; loading: boolean }) {
    return (
        <div className={`bg-white rounded-xl shadow p-5 border-r-4 ${color}`}>
            <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? '...' : value}</p>
        </div>
    );
}

function roleBadgeClass(role: string): string {
    if (role === 'admin') return 'bg-red-100 text-red-800 border-red-200';
    if (role === 'manager') return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
}

function roleLabel(role: string): string {
    if (role === 'admin') return 'מנהל-על';
    if (role === 'manager') return 'מנהל';
    return 'עובד';
}

function toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function prevWeekId(weekId: string): string {
    const dates = getWeekDates(weekId);
    const prevSun = new Date(dates[0]);
    prevSun.setDate(prevSun.getDate() - 7);
    return getWeekId(prevSun);
}

function nextWeekId(weekId: string): string {
    const dates = getWeekDates(weekId);
    const nextSun = new Date(dates[0]);
    nextSun.setDate(nextSun.getDate() + 7);
    return getWeekId(nextSun);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    // Tab
    const [activeTab, setActiveTab] = useState<'users' | 'constraints' | 'schedules'>('users');

    // Stats
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // Users tab
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'manager' | 'employee'>('all');
    const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
    const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
    const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM);
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Constraints tab
    const [constraintWeekId, setConstraintWeekId] = useState(getCurrentWeekId());
    const [constraints, setConstraints] = useState<AdminConstraint[]>([]);
    const [isLoadingConstraints, setIsLoadingConstraints] = useState(false);
    const [overrideForm, setOverrideForm] = useState<OverrideFormData | null>(null);
    const [isOverrideSaving, setIsOverrideSaving] = useState(false);
    const [overrideError, setOverrideError] = useState<string | null>(null);

    // Schedules tab
    const [schedules, setSchedules] = useState<AdminSchedule[]>([]);
    const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
    const [confirmDeleteSchedule, setConfirmDeleteSchedule] = useState<string | null>(null);
    const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);

    // Toast
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // ── Data loaders ──────────────────────────────────────────────────────────

    const showToast = (text: string, type: 'success' | 'error') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4000);
    };

    const loadStats = useCallback(async () => {
        setIsLoadingStats(true);
        try {
            const res = await adminAPI.getStats();
            setStats(res.data.data);
        } catch {
            // Non-critical — stats are cosmetic
        } finally {
            setIsLoadingStats(false);
        }
    }, []);

    const loadUsers = useCallback(async () => {
        setIsLoadingUsers(true);
        try {
            const res = await adminAPI.getAllUsers();
            setUsers(res.data.data ?? []);
        } catch {
            showToast('שגיאה בטעינת המשתמשים', 'error');
        } finally {
            setIsLoadingUsers(false);
        }
    }, []);

    const loadConstraints = useCallback(async (weekId: string) => {
        setIsLoadingConstraints(true);
        try {
            const res = await adminAPI.getAllConstraints(weekId);
            setConstraints(res.data.data ?? []);
        } catch {
            showToast('שגיאה בטעינת האילוצים', 'error');
        } finally {
            setIsLoadingConstraints(false);
        }
    }, []);

    const loadSchedules = useCallback(async () => {
        setIsLoadingSchedules(true);
        try {
            const res = await adminAPI.getAllSchedules();
            setSchedules(res.data.data ?? []);
        } catch {
            showToast('שגיאה בטעינת הסידורים', 'error');
        } finally {
            setIsLoadingSchedules(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadStats();
        loadUsers();
    }, [loadStats, loadUsers]);

    // Load tab-specific data on tab switch
    useEffect(() => {
        if (activeTab === 'constraints') loadConstraints(constraintWeekId);
        if (activeTab === 'schedules') loadSchedules();
    }, [activeTab, loadConstraints, loadSchedules, constraintWeekId]);

    // ── Users Tab handlers ────────────────────────────────────────────────────

    const openCreate = () => {
        setFormData(EMPTY_FORM);
        setFormError(null);
        setEditTarget(null);
        setModalMode('create');
    };

    const openEdit = (u: AdminUser) => {
        setFormData({
            name: u.name,
            email: u.email,
            password: '',
            role: u.role,
            isFixedMorning: u.isFixedMorning,
            isActive: u.isActive,
        });
        setFormError(null);
        setEditTarget(u);
        setModalMode('edit');
    };

    const closeModal = () => {
        setModalMode(null);
        setEditTarget(null);
        setFormError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!formData.name.trim() || !formData.email.trim()) {
            setFormError('שם ואימייל הם שדות חובה');
            return;
        }
        if (modalMode === 'create' && !formData.password) {
            setFormError('סיסמה היא שדה חובה ביצירת משתמש חדש');
            return;
        }

        setIsSaving(true);
        try {
            if (modalMode === 'create') {
                await adminAPI.createUser({
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                    password: formData.password,
                    role: formData.role,
                    isFixedMorning: formData.isFixedMorning,
                    isActive: formData.isActive,
                });
                showToast('המשתמש נוצר בהצלחה', 'success');
            } else if (modalMode === 'edit' && editTarget) {
                const payload: Parameters<typeof adminAPI.updateUser>[1] = {
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                    role: formData.role,
                    isFixedMorning: formData.isFixedMorning,
                    isActive: formData.isActive,
                };
                if (formData.password) payload.password = formData.password;
                await adminAPI.updateUser(editTarget._id, payload);
                showToast('פרטי המשתמש עודכנו בהצלחה', 'success');
            }
            closeModal();
            await Promise.all([loadUsers(), loadStats()]);
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'שגיאה בשמירת הנתונים');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (hard: boolean) => {
        if (!confirmDelete) return;
        setIsDeleting(true);
        try {
            await adminAPI.deleteUser(confirmDelete._id, hard);
            showToast(hard ? 'המשתמש נמחק לצמיתות' : 'המשתמש בוטל בהצלחה', 'success');
            setConfirmDelete(null);
            await Promise.all([loadUsers(), loadStats()]);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'שגיאה במחיקת המשתמש', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReactivate = async (u: AdminUser) => {
        try {
            await adminAPI.updateUser(u._id, { isActive: true });
            showToast('המשתמש הופעל מחדש', 'success');
            await loadUsers();
        } catch {
            showToast('שגיאה בהפעלת המשתמש', 'error');
        }
    };

    const filteredUsers = users
        .filter(u => userRoleFilter === 'all' || u.role === userRoleFilter)
        .filter(u =>
            userSearch === '' ||
            u.name.includes(userSearch) ||
            u.email.toLowerCase().includes(userSearch.toLowerCase())
        );

    // ── Constraints Tab handlers ───────────────────────────────────────────────

    const openOverrideModal = (constraint: AdminConstraint) => {
        // Build full 7-day × 3-shift grid, pre-filling from existing constraint
        const weekDates = getWeekDates(constraintWeekId);
        const existingMap = new Map(
            constraint.constraints.map(c => [`${toDateKey(new Date(c.date))}_${c.shift}`, c])
        );

        const allEntries: ConstraintEntry[] = [];
        const shifts: Array<'morning' | 'afternoon' | 'night'> = ['morning', 'afternoon', 'night'];
        for (const date of weekDates) {
            for (const shift of shifts) {
                const key = `${toDateKey(date)}_${shift}`;
                const existing = existingMap.get(key);
                allEntries.push({
                    date: toDateKey(date),
                    shift,
                    canWork: existing ? existing.canWork : true,
                    availableFrom: existing?.availableFrom ?? null,
                    availableTo: existing?.availableTo ?? null,
                });
            }
        }

        setOverrideForm({
            userId: constraint.userId._id,
            userName: constraint.userId.name,
            weekId: constraintWeekId,
            constraints: allEntries,
        });
        setOverrideError(null);
    };

    const updateOverrideEntry = (date: string, shift: string, field: string, value: boolean | string | null) => {
        setOverrideForm(prev => {
            if (!prev) return null;
            return {
                ...prev,
                constraints: prev.constraints.map(c =>
                    c.date === date && c.shift === shift
                        ? { ...c, [field]: value }
                        : c
                ),
            };
        });
    };

    const handleOverrideSave = async () => {
        if (!overrideForm) return;
        setIsOverrideSaving(true);
        setOverrideError(null);
        try {
            await adminAPI.overrideConstraint(overrideForm.userId, overrideForm.weekId, overrideForm.constraints);
            showToast('האילוצים עודכנו בהצלחה', 'success');
            setOverrideForm(null);
            await loadConstraints(constraintWeekId);
        } catch (err: any) {
            setOverrideError(err.response?.data?.message || 'שגיאה בשמירת האילוצים');
        } finally {
            setIsOverrideSaving(false);
        }
    };

    // ── Schedules Tab handlers ────────────────────────────────────────────────

    const handleDeleteSchedule = async () => {
        if (!confirmDeleteSchedule) return;
        setIsDeletingSchedule(true);
        try {
            await adminAPI.forceDeleteSchedule(confirmDeleteSchedule);
            showToast('הסידור נמחק בהצלחה', 'success');
            setConfirmDeleteSchedule(null);
            await Promise.all([loadSchedules(), loadStats()]);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'שגיאה במחיקת הסידור', 'error');
        } finally {
            setIsDeletingSchedule(false);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    // ── Constraint matrix helpers ─────────────────────────────────────────────

    const weekDatesForConstraints = getWeekDates(constraintWeekId);

    const getConstraintForCell = (constraint: AdminConstraint, date: Date, shift: string): ConstraintEntry | undefined => {
        const dateStr = toDateKey(date);
        return constraint.constraints.find(
            c => toDateKey(new Date(c.date)) === dateStr && c.shift === shift
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const TABS = [
        { id: 'users' as const, label: 'משתמשים' },
        { id: 'constraints' as const, label: 'אילוצים' },
        { id: 'schedules' as const, label: 'סידורים' },
    ];

    return (
        <div className="min-h-screen bg-gray-100" dir="rtl">
            {/* Navbar */}
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">מנהל-על</span>
                        <h1 className="text-xl font-bold text-gray-800">לוח בקרה מנהל-על</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium text-sm">לוח הבקרה</Link>
                        <span className="text-gray-600 text-sm">שלום, {user?.name}</span>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm"
                        >
                            התנתק
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="סה״כ משתמשים" value={stats?.totalUsers ?? 0} color="border-indigo-500" loading={isLoadingStats} />
                    <StatCard label="מנהלים פעילים" value={stats?.activeManagers ?? 0} color="border-purple-500" loading={isLoadingStats} />
                    <StatCard label="עובדים פעילים" value={stats?.activeEmployees ?? 0} color="border-green-500" loading={isLoadingStats} />
                    <StatCard
                        label="סידורים פורסמו"
                        value={isLoadingStats ? '...' : `${stats?.publishedSchedules ?? 0} / ${stats?.totalSchedules ?? 0}`}
                        color="border-blue-500"
                        loading={false}
                    />
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Users Tab ── */}
                {activeTab === 'users' && (
                    <div className="space-y-4">
                        {/* Toolbar */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    placeholder="חיפוש לפי שם או אימייל..."
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                                />
                                <select
                                    value={userRoleFilter}
                                    onChange={e => setUserRoleFilter(e.target.value as any)}
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="all">כל התפקידים</option>
                                    <option value="admin">מנהל-על</option>
                                    <option value="manager">מנהל</option>
                                    <option value="employee">עובד</option>
                                </select>
                            </div>
                            <button
                                onClick={openCreate}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 transition-colors text-sm"
                            >
                                <span className="text-lg leading-none">+</span>
                                הוסף משתמש חדש
                            </button>
                        </div>

                        {/* Users Table */}
                        <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-4 font-semibold">שם</th>
                                            <th className="px-5 py-4 font-semibold">אימייל</th>
                                            <th className="px-5 py-4 font-semibold text-center">תפקיד</th>
                                            <th className="px-5 py-4 font-semibold text-center">קבוע בוקר</th>
                                            <th className="px-5 py-4 font-semibold text-center">סטטוס</th>
                                            <th className="px-5 py-4 font-semibold text-center">נוצר</th>
                                            <th className="px-5 py-4 font-semibold text-center">פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {isLoadingUsers ? (
                                            <tr>
                                                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">טוען...</td>
                                            </tr>
                                        ) : filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">לא נמצאו משתמשים</td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map(u => (
                                                <tr
                                                    key={u._id}
                                                    className={`transition-colors ${u.isActive ? 'hover:bg-slate-50' : 'bg-slate-50 opacity-60'}`}
                                                >
                                                    <td className="px-5 py-4 font-medium text-slate-900">{u.name}</td>
                                                    <td className="px-5 py-4 text-slate-600 text-xs" dir="ltr">{u.email}</td>
                                                    <td className="px-5 py-4 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${roleBadgeClass(u.role)}`}>
                                                                {roleLabel(u.role)}
                                                            </span>
                                                            {u.role === 'admin' && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-300">
                                                                    אינו בתזמון
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {u.isFixedMorning ? (
                                                            <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">כן</span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {u.isActive ? (
                                                            <span className="text-xs px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-200">פעיל</span>
                                                        ) : (
                                                            <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-300">לא פעיל</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center text-xs text-slate-500">
                                                        {formatDate(u.createdAt)}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => openEdit(u)}
                                                                className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                                            >
                                                                ערוך
                                                            </button>
                                                            {u.isActive ? (
                                                                <button
                                                                    onClick={() => setConfirmDelete(u)}
                                                                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                                                >
                                                                    מחק / בטל
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleReactivate(u)}
                                                                    className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                                                                >
                                                                    הפעל מחדש
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Constraints Tab ── */}
                {activeTab === 'constraints' && (
                    <div className="space-y-4">
                        {/* Week Navigator */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setConstraintWeekId(prevWeekId(constraintWeekId))}
                                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                ← שבוע קודם
                            </button>
                            <div className="text-sm font-semibold text-slate-700">
                                {constraintWeekId} | {formatWeekDateRange(constraintWeekId)}
                            </div>
                            <button
                                onClick={() => setConstraintWeekId(nextWeekId(constraintWeekId))}
                                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                שבוע הבא →
                            </button>
                        </div>

                        {isLoadingConstraints ? (
                            <div className="text-center py-10 text-slate-500">טוען אילוצים...</div>
                        ) : constraints.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 bg-white rounded-lg shadow border border-slate-200">
                                אין עובדים פעילים במערכת
                            </div>
                        ) : (
                            <div className="bg-white shadow rounded-lg border border-slate-200 overflow-x-auto">
                                <table className="text-xs text-right w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold sticky right-0 bg-slate-50 z-10 min-w-[140px]">עובד</th>
                                            {weekDatesForConstraints.map((date, i) => (
                                                <th key={i} colSpan={3} className="px-2 py-3 text-center font-semibold border-r border-slate-200">
                                                    <div>{DAY_LABELS[i]}</div>
                                                    <div className="text-slate-400 font-normal">{date.getDate()}/{date.getMonth() + 1}</div>
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 font-semibold text-center">עריכה</th>
                                        </tr>
                                        <tr className="border-b border-slate-200 bg-slate-50">
                                            <th className="px-4 py-2 sticky right-0 bg-slate-50 z-10" />
                                            {weekDatesForConstraints.map((_, i) => (
                                                <>
                                                    <th key={`${i}-m`} className="px-1 py-2 text-center text-slate-500 font-normal border-r border-slate-100">ב׳</th>
                                                    <th key={`${i}-a`} className="px-1 py-2 text-center text-slate-500 font-normal border-r border-slate-100">צ׳</th>
                                                    <th key={`${i}-n`} className="px-1 py-2 text-center text-slate-500 font-normal border-r border-slate-200">ל׳</th>
                                                </>
                                            ))}
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {constraints.map(constraint => (
                                            <tr key={constraint._id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-900 sticky right-0 bg-white hover:bg-slate-50 z-10">
                                                    <div>{constraint.userId.name}</div>
                                                    {constraint.isLocked && (
                                                        <span className="text-xs text-amber-600">🔒 נעול</span>
                                                    )}
                                                </td>
                                                {weekDatesForConstraints.map((date) => {
                                                    const shifts: Array<'morning' | 'afternoon' | 'night'> = ['morning', 'afternoon', 'night'];
                                                    return shifts.map((shift, si) => {
                                                        const entry = getConstraintForCell(constraint, date, shift);
                                                        const isLast = si === 2;
                                                        if (!entry) {
                                                            return (
                                                                <td key={`${toDateKey(date)}-${shift}`} className={`px-1 py-3 text-center text-slate-300 ${isLast ? 'border-r border-slate-200' : 'border-r border-slate-100'}`}>—</td>
                                                            );
                                                        }
                                                        if (entry.canWork === false) {
                                                            return (
                                                                <td key={`${toDateKey(date)}-${shift}`} className={`px-1 py-3 text-center ${isLast ? 'border-r border-slate-200' : 'border-r border-slate-100'}`}>
                                                                    <span className="inline-block w-4 h-4 rounded-full bg-red-500" title="לא יכול לעבוד" />
                                                                </td>
                                                            );
                                                        }
                                                        if (entry.availableFrom || entry.availableTo) {
                                                            return (
                                                                <td key={`${toDateKey(date)}-${shift}`} className={`px-1 py-3 text-center ${isLast ? 'border-r border-slate-200' : 'border-r border-slate-100'}`}>
                                                                    <span className="inline-block w-4 h-4 rounded-full bg-amber-400" title={`חלקי: ${entry.availableFrom ?? ''}–${entry.availableTo ?? ''}`} />
                                                                </td>
                                                            );
                                                        }
                                                        return (
                                                            <td key={`${toDateKey(date)}-${shift}`} className={`px-1 py-3 text-center ${isLast ? 'border-r border-slate-200' : 'border-r border-slate-100'}`}>
                                                                <span className="inline-block w-4 h-4 rounded-full bg-green-400" title="יכול לעבוד" />
                                                            </td>
                                                        );
                                                    });
                                                })}
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => openOverrideModal(constraint)}
                                                        className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100"
                                                    >
                                                        עריכת אילוצים
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="p-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500" /> לא יכול לעבוד</span>
                                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-amber-400" /> זמינות חלקית</span>
                                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-green-400" /> יכול לעבוד</span>
                                    <span className="flex items-center gap-1"><span className="text-slate-300">—</span> ללא אילוץ</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Schedules Tab ── */}
                {activeTab === 'schedules' && (
                    <div className="space-y-4">
                        <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-4 font-semibold">שבוע</th>
                                            <th className="px-5 py-4 font-semibold">תאריך התחלה</th>
                                            <th className="px-5 py-4 font-semibold text-center">סטטוס</th>
                                            <th className="px-5 py-4 font-semibold text-center">נוצר</th>
                                            <th className="px-5 py-4 font-semibold text-center">פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {isLoadingSchedules ? (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-10 text-center text-slate-500">טוען...</td>
                                            </tr>
                                        ) : schedules.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-10 text-center text-slate-500">לא נמצאו סידורים</td>
                                            </tr>
                                        ) : (
                                            schedules.map(s => {
                                                const weekId = getWeekId(new Date(s.weekStartDate));
                                                return (
                                                    <tr key={s._id} className="hover:bg-slate-50">
                                                        <td className="px-5 py-4 font-mono font-medium text-slate-900">{weekId}</td>
                                                        <td className="px-5 py-4 text-slate-600">{formatDate(s.weekStartDate)}</td>
                                                        <td className="px-5 py-4 text-center">
                                                            {s.isPublished ? (
                                                                <span className="text-xs px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-200">פורסם</span>
                                                            ) : (
                                                                <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-200">טיוטה</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-4 text-center text-xs text-slate-500">{formatDate(s.createdAt)}</td>
                                                        <td className="px-5 py-4 text-center">
                                                            <button
                                                                onClick={() => setConfirmDeleteSchedule(weekId)}
                                                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                                            >
                                                                מחק
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* ── Create / Edit User Modal ── */}
            {modalMode && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5" dir="rtl">
                        <h2 className="text-lg font-bold text-slate-800">
                            {modalMode === 'create' ? 'הוספת משתמש חדש' : 'עריכת פרטי משתמש'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">שם מלא *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="ישראל ישראלי"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">אימייל *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="israel@example.com"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    סיסמה
                                    {modalMode === 'edit' && <span className="text-slate-400 font-normal"> (השאר ריק לאי-שינוי)</span>}
                                    {modalMode === 'create' && ' *'}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="סיסמה זמנית"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">תפקיד</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData(p => ({ ...p, role: e.target.value as UserFormData['role'] }))}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="employee">עובד</option>
                                    <option value="manager">מנהל</option>
                                    <option value="admin">מנהל-על</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isFixedMorning}
                                        onChange={e => setFormData(p => ({ ...p, isFixedMorning: e.target.checked }))}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-slate-700">קבוע במשמרת בוקר</span>
                                </label>
                                {modalMode === 'edit' && (
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-slate-700">חשבון פעיל</span>
                                    </label>
                                )}
                            </div>
                            {formError && (
                                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    {formError}
                                </div>
                            )}
                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors text-sm"
                                >
                                    ביטול
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                                >
                                    {isSaving ? 'שומר...' : modalMode === 'create' ? 'צור משתמש' : 'שמור שינויים'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete User Confirmation Modal ── */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" dir="rtl">
                        <h2 className="text-lg font-bold text-slate-800">מחיקת משתמש</h2>
                        <p className="text-slate-600 text-sm">
                            מה לעשות עם <strong>{confirmDelete.name}</strong>?
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                            <strong>מחיקה קבועה</strong> תסיר את המשתמש לצמיתות מהמסד. <br />
                            <strong>ביטול פעילות</strong> ימנע כניסה אך ישמור את הנתונים.
                        </div>
                        <div className="flex gap-2 justify-end flex-wrap">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors text-sm"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={() => handleDelete(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors text-sm"
                            >
                                {isDeleting ? 'מבצע...' : 'בטל פעילות'}
                            </button>
                            <button
                                onClick={() => handleDelete(true)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 transition-colors text-sm"
                            >
                                {isDeleting ? 'מבצע...' : 'מחק לצמיתות'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Constraint Override Modal ── */}
            {overrideForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4" dir="rtl">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800">עריכת אילוצים — {overrideForm.userName}</h2>
                            <span className="text-sm text-slate-500">{overrideForm.weekId}</span>
                        </div>
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                            שינוי אילוצים כמנהל-על ינעל אותם אוטומטית. העובד לא יוכל לשנות אותם.
                        </p>

                        <div className="space-y-2">
                            {weekDatesForConstraints.map((date, dayIndex) => {
                                const dateStr = toDateKey(date);
                                const shifts: Array<'morning' | 'afternoon' | 'night'> = ['morning', 'afternoon', 'night'];
                                return (
                                    <div key={dateStr} className="border border-slate-200 rounded-lg p-3">
                                        <p className="text-sm font-semibold text-slate-700 mb-2">
                                            {DAY_LABELS[dayIndex]} — {date.getDate()}/{date.getMonth() + 1}
                                        </p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {shifts.map(shift => {
                                                const entry = overrideForm.constraints.find(c => c.date === dateStr && c.shift === shift);
                                                if (!entry) return null;
                                                return (
                                                    <div key={shift} className={`p-2 rounded-lg border text-xs ${!entry.canWork ? 'bg-red-50 border-red-200' : (entry.availableFrom || entry.availableTo) ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                                                        <div className="font-medium mb-1">{SHIFT_LABELS[shift]}</div>
                                                        <label className="flex items-center gap-1.5 cursor-pointer mb-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={entry.canWork}
                                                                onChange={e => updateOverrideEntry(dateStr, shift, 'canWork', e.target.checked)}
                                                                className="w-3 h-3"
                                                            />
                                                            <span>יכול לעבוד</span>
                                                        </label>
                                                        {entry.canWork && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-slate-500 text-xs w-8">מ:</span>
                                                                    <input
                                                                        type="time"
                                                                        value={entry.availableFrom ?? ''}
                                                                        onChange={e => updateOverrideEntry(dateStr, shift, 'availableFrom', e.target.value || null)}
                                                                        className="border border-slate-300 rounded px-1 py-0.5 text-xs w-full"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-slate-500 text-xs w-8">עד:</span>
                                                                    <input
                                                                        type="time"
                                                                        value={entry.availableTo ?? ''}
                                                                        onChange={e => updateOverrideEntry(dateStr, shift, 'availableTo', e.target.value || null)}
                                                                        className="border border-slate-300 rounded px-1 py-0.5 text-xs w-full"
                                                                    />
                                                                </div>
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

                        {overrideError && (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                {overrideError}
                            </div>
                        )}

                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() => setOverrideForm(null)}
                                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors text-sm"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleOverrideSave}
                                disabled={isOverrideSaving}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                {isOverrideSaving ? 'שומר...' : 'שמור אילוצים'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Schedule Confirmation Modal ── */}
            {confirmDeleteSchedule && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" dir="rtl">
                        <h2 className="text-lg font-bold text-slate-800">מחיקת סידור</h2>
                        <p className="text-slate-600 text-sm">
                            האם למחוק את הסידור של שבוע <strong>{confirmDeleteSchedule}</strong>?
                            <br />
                            <span className="text-red-600 text-xs">פעולה זו אינה ניתנת לשחזור.</span>
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setConfirmDeleteSchedule(null)}
                                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors text-sm"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleDeleteSchedule}
                                disabled={isDeletingSchedule}
                                className="px-4 py-2 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                {isDeletingSchedule ? 'מוחק...' : 'כן, מחק סידור'}
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
