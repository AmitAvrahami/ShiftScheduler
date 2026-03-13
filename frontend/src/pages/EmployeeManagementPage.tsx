import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../lib/api';

interface Employee {
    _id: string;
    name: string;
    email: string;
    role: 'manager' | 'employee';
    isFixedMorning: boolean;
    isActive: boolean;
}

interface EmployeeFormData {
    name: string;
    email: string;
    password: string;
    role: 'manager' | 'employee';
    isFixedMorning: boolean;
    isActive: boolean;
}

const EMPTY_FORM: EmployeeFormData = {
    name: '',
    email: '',
    password: '',
    role: 'employee',
    isFixedMorning: false,
    isActive: true,
};

export default function EmployeeManagementPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Modal state
    const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
    const [editTarget, setEditTarget] = useState<Employee | null>(null);
    const [formData, setFormData] = useState<EmployeeFormData>(EMPTY_FORM);
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Deactivation confirm state
    const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null);
    const [isDeactivating, setIsDeactivating] = useState(false);

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        setIsLoading(true);
        try {
            const res = await usersAPI.getAllForManagement();
            setEmployees(res.data.data ?? []);
        } catch {
            showToast('שגיאה בטעינת העובדים', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const showToast = (text: string, type: 'success' | 'error') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4000);
    };

    const openCreate = () => {
        setFormData(EMPTY_FORM);
        setFormError(null);
        setEditTarget(null);
        setModalMode('create');
    };

    const openEdit = (emp: Employee) => {
        setFormData({
            name: emp.name,
            email: emp.email,
            password: '',
            role: emp.role,
            isFixedMorning: emp.isFixedMorning,
            isActive: emp.isActive,
        });
        setFormError(null);
        setEditTarget(emp);
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
            setFormError('סיסמה היא שדה חובה ביצירת עובד חדש');
            return;
        }

        setIsSaving(true);
        try {
            if (modalMode === 'create') {
                await usersAPI.create({
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                    password: formData.password,
                    role: formData.role,
                    isFixedMorning: formData.isFixedMorning,
                });
                showToast('העובד נוצר בהצלחה', 'success');
            } else if (modalMode === 'edit' && editTarget) {
                const payload: Parameters<typeof usersAPI.update>[1] = {
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                    role: formData.role,
                    isFixedMorning: formData.isFixedMorning,
                    isActive: formData.isActive,
                };
                if (formData.password) payload.password = formData.password;
                await usersAPI.update(editTarget._id, payload);
                showToast('פרטי העובד עודכנו בהצלחה', 'success');
            }
            closeModal();
            await loadEmployees();
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'שגיאה בשמירת הנתונים');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeactivate = async () => {
        if (!confirmDeactivate) return;
        setIsDeactivating(true);
        try {
            await usersAPI.deactivate(confirmDeactivate._id);
            showToast('העובד בוטל בהצלחה', 'success');
            setConfirmDeactivate(null);
            await loadEmployees();
        } catch {
            showToast('שגיאה בביטול העובד', 'error');
        } finally {
            setIsDeactivating(false);
        }
    };

    const handleReactivate = async (emp: Employee) => {
        try {
            await usersAPI.update(emp._id, { isActive: true });
            showToast('העובד הופעל מחדש', 'success');
            await loadEmployees();
        } catch {
            showToast('שגיאה בהפעלת העובד', 'error');
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
                        &rarr; חזרה ללוח הבקרה
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-800">ניהול עובדים</h1>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
                >
                    <span className="text-lg leading-none">+</span>
                    הוסף עובד חדש
                </button>
            </div>

            {/* Employee Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">שם</th>
                                <th className="px-6 py-4 font-semibold">אימייל</th>
                                <th className="px-6 py-4 font-semibold text-center">תפקיד</th>
                                <th className="px-6 py-4 font-semibold text-center">קבוע בוקר</th>
                                <th className="px-6 py-4 font-semibold text-center">סטטוס</th>
                                <th className="px-6 py-4 font-semibold text-center">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">טוען...</td>
                                </tr>
                            ) : employees.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">לא נמצאו עובדים</td>
                                </tr>
                            ) : (
                                employees.map(emp => (
                                    <tr
                                        key={emp._id}
                                        className={`transition-colors ${emp.isActive ? 'hover:bg-slate-50' : 'bg-slate-50 opacity-60'}`}
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-900">{emp.name}</td>
                                        <td className="px-6 py-4 text-slate-600">{emp.email}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${emp.role === 'manager' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                                                {emp.role === 'manager' ? 'מנהל' : 'עובד'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {emp.isFixedMorning ? (
                                                <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">כן</span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {emp.isActive ? (
                                                <span className="text-xs px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-200">פעיל</span>
                                            ) : (
                                                <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-300">לא פעיל</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openEdit(emp)}
                                                    className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                                >
                                                    ערוך
                                                </button>
                                                {emp.role !== 'manager' && (
                                                    emp.isActive ? (
                                                        <button
                                                            onClick={() => setConfirmDeactivate(emp)}
                                                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                                        >
                                                            בטל פעילות
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleReactivate(emp)}
                                                            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                                                        >
                                                            הפעל מחדש
                                                        </button>
                                                    )
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

            {/* Create / Edit Modal */}
            {modalMode && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5" dir="rtl">
                        <h2 className="text-lg font-bold text-slate-800">
                            {modalMode === 'create' ? 'הוספת עובד חדש' : 'עריכת פרטי עובד'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Name */}
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

                            {/* Email */}
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

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    סיסמה {modalMode === 'edit' && <span className="text-slate-400 font-normal">(השאר ריק לאי-שינוי)</span>}
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

                            {/* Role */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">תפקיד</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData(p => ({ ...p, role: e.target.value as 'manager' | 'employee' }))}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    <option value="employee">עובד</option>
                                    <option value="manager">מנהל</option>
                                </select>
                            </div>

                            {/* Checkboxes */}
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
                                    {isSaving ? 'שומר...' : modalMode === 'create' ? 'צור עובד' : 'שמור שינויים'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Deactivation Confirmation Modal */}
            {confirmDeactivate && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" dir="rtl">
                        <h2 className="text-lg font-bold text-slate-800">ביטול פעילות עובד</h2>
                        <p className="text-slate-600 text-sm">
                            האם לבטל את פעילות <strong>{confirmDeactivate.name}</strong>?
                            העובד לא יוכל להתחבר למערכת, אך הנתונים ההיסטוריים שלו יישמרו.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setConfirmDeactivate(null)}
                                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors text-sm"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleDeactivate}
                                disabled={isDeactivating}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                {isDeactivating ? 'מבטל...' : 'כן, בטל פעילות'}
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
