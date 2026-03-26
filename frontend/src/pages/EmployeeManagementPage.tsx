import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI, constraintAPI } from '../lib/api';
import { getCurrentWeekId } from '../utils/weekUtils';

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
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // Filters & Pagination state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    
    // Constraints tracking Map<userId, isSubmitted>
    const [constraintsStatus, setConstraintsStatus] = useState<Map<string, boolean>>(new Map());

    const ITEMS_PER_PAGE = 8;

    // Modal state
    const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
    const [editTarget, setEditTarget] = useState<Employee | null>(null);
    const [formData, setFormData] = useState<EmployeeFormData>(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState<{name?: string; email?: string; password?: string}>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Deactivation confirm state
    const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null);
    const [isDeactivating, setIsDeactivating] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    // Reset to page 1 whenever filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, constraintsRes] = await Promise.all([
                usersAPI.getAllForManagement(),
                constraintAPI.getWeekConstraints(getCurrentWeekId())
            ]);
            
            setEmployees(usersRes.data.data ?? []);
            
            // Build map of who submitted constraints
            const constraintsArray = constraintsRes.data.data ?? [];
            const newConstraintsMap = new Map<string, boolean>();
            constraintsArray.forEach((c: any) => {
                const uid = typeof c.userId === 'object' ? c.userId._id : c.userId;
                newConstraintsMap.set(uid, true);
            });
            setConstraintsStatus(newConstraintsMap);

        } catch {
            showToast('שגיאה בטעינת הנתונים', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const showToast = (text: string, type: 'success' | 'error') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4000);
    };

    const validateEmail = (email: string) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    const handleFieldChange = (field: keyof EmployeeFormData, value: any) => {
        setFormData(p => ({ ...p, [field]: value }));
        
        // Real-time validation
        const errors = { ...formErrors };
        if (field === 'name') {
            if (typeof value === 'string' && !value.trim()) errors.name = 'שדה זה חובה';
            else delete errors.name;
        }
        if (field === 'email') {
            if (typeof value === 'string' && !value.trim()) errors.email = 'שדה זה חובה';
            else if (typeof value === 'string' && !validateEmail(value)) errors.email = 'כתובת אימייל לא תקינה';
            else delete errors.email;
        }
        if (field === 'password' && modalMode === 'create') {
            if (!value) errors.password = 'שדה זה חובה';
            else delete errors.password;
        }
        setFormErrors(errors);
    };

    const openCreate = () => {
        setFormData(EMPTY_FORM);
        setFormErrors({});
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
        setFormErrors({});
        setFormError(null);
        setEditTarget(emp);
        setModalMode('edit');
    };

    const closeModal = () => {
        setModalMode(null);
        setEditTarget(null);
        setFormErrors({});
        setFormError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const errors: {name?: string; email?: string; password?: string} = {};
        if (!formData.name.trim()) errors.name = 'שדה זה חובה';
        if (!formData.email.trim()) errors.email = 'שדה זה חובה';
        else if (!validateEmail(formData.email)) errors.email = 'כתובת אימייל לא תקינה';
        
        if (modalMode === 'create' && !formData.password) {
            errors.password = 'שדה זה חובה';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
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
            await loadData();
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
            await loadData();
        } catch {
            showToast('שגיאה בביטול העובד', 'error');
        } finally {
            setIsDeactivating(false);
        }
    };

    const getInitials = (name: string) => {
        const parts = name.trim().split(' ').filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    // Derived filtered and paginated data
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            // Search filter
            const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  emp.email.toLowerCase().includes(searchQuery.toLowerCase());
            // Status filter
            const matchesStatus = statusFilter === 'all' || 
                                 (statusFilter === 'active' && emp.isActive) ||
                                 (statusFilter === 'inactive' && !emp.isActive);
            return matchesSearch && matchesStatus;
        });
    }, [employees, searchQuery, statusFilter]);

    const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE) || 1;
    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length);

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold text-slate-800">ניהול עובדים</h1>
                    <p className="text-slate-500 text-sm">נהל את צוות העובדים, התפקידים וההרשאות שלהם</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    הוסף עובד חדש
                </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        סינון נוסף
                    </button>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full md:w-auto px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="all">כל הסטטוסים</option>
                        <option value="active">פעיל</option>
                        <option value="inactive">לא פעיל</option>
                    </select>
                </div>
                
                <div className="flex flex-1 w-full max-w-sm relative">
                    <input 
                        type="text" 
                        placeholder="חפש לפי שם או אימייל..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <svg className="w-5 h-5 text-slate-400 absolute right-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200 pb-2">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="text-sm text-slate-700 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold w-1/4">שם העובד</th>
                                <th className="px-6 py-4 font-semibold w-1/4">אימייל</th>
                                <th className="px-6 py-4 font-semibold text-center w-1/6">תפקיד</th>
                                <th className="px-6 py-4 font-semibold text-center w-1/6">סטטוס</th>
                                <th className="px-6 py-4 font-semibold text-center w-1/6">אילוצים</th>
                                <th className="px-6 py-4 font-semibold text-center whitespace-nowrap">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <>
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                        <tr key={`skeleton-${idx}`} className="border-b border-slate-100">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>
                                                    <div className="h-4 w-32 bg-slate-200 rounded-full animate-pulse"></div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-4 w-40 bg-slate-200 rounded-full animate-pulse ml-auto"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-4 w-16 bg-slate-200 rounded-full animate-pulse mx-auto"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse mx-auto"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-4 w-20 bg-slate-200 rounded-full animate-pulse mx-auto"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="w-5 h-5 bg-slate-200 rounded animate-pulse"></div>
                                                    <div className="w-5 h-5 bg-slate-200 rounded animate-pulse"></div>
                                                    <div className="w-5 h-5 bg-slate-200 rounded animate-pulse"></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            ) : paginatedEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16">
                                        <div className="flex flex-col items-center justify-center text-center">
                                            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12H13M17 8v8" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-800 mb-1">אין עובדים עדיין</h3>
                                            <p className="text-slate-500 text-sm mb-6 max-w-sm">
                                                הוסף עובד כדי להתחיל לנהל את המשמרות והצוות שלך
                                            </p>
                                            <button
                                                onClick={openCreate}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                                </svg>
                                                הוסף עובד ראשון
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedEmployees.map(emp => {
                                    const avatarInitials = getInitials(emp.name);
                                    const roleColors = emp.role === 'manager' 
                                        ? 'bg-purple-100 text-purple-700' 
                                        : 'bg-indigo-100 text-indigo-700';
                                    
                                    const hasSubmittedConstraints = constraintsStatus.get(emp._id);

                                    return (
                                        <tr key={emp._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${roleColors}`}>
                                                        {avatarInitials}
                                                    </div>
                                                    <span className={`font-semibold ${!emp.isActive && 'text-slate-400'}`}>
                                                        {emp.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 ${!emp.isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                                                {emp.email}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`${!emp.isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                                                    {emp.role === 'manager' ? 'מנהל' : 'מפעיל'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {emp.isActive ? (
                                                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-800">פעיל</span>
                                                ) : (
                                                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">לא פעיל</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {!emp.isActive ? (
                                                    <span className="text-slate-400 font-medium">-</span>
                                                ) : hasSubmittedConstraints ? (
                                                    <span className="text-green-600 font-medium flex items-center justify-center gap-1">
                                                        הוגש &#10003;
                                                    </span>
                                                ) : (
                                                    <span className="text-orange-500 font-medium flex items-center justify-center gap-1">
                                                        בהמתנה &#9679;
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    {/* Delete/Deactivate Action */}
                                                    {emp.role !== 'manager' && emp.isActive && (
                                                        <button
                                                            onClick={() => setConfirmDeactivate(emp)}
                                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                                            title="מחק עובד"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    {emp.role !== 'manager' && !emp.isActive && (
                                                        <button className="text-slate-300 cursor-not-allowed">
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    )}

                                                    {/* View Profile Action */}
                                                    <button
                                                        onClick={() => navigate(`/manager/employees/${emp._id}`)}
                                                        className="text-slate-400 hover:text-blue-500 transition-colors"
                                                        title="צפה בפרופיל"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    </button>
                                                    
                                                    {/* Edit Action */}
                                                    <button
                                                        onClick={() => openEdit(emp)}
                                                        className="text-slate-400 hover:text-indigo-500 transition-colors"
                                                        title="ערוך"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {!isLoading && filteredEmployees.length > 0 && (
                    <div className="flex flex-col md:flex-row items-center justify-between p-4 border-t border-slate-200 mt-2 gap-4">
                        <div className="flex gap-1.5">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                הקודם
                            </button>
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`px-3 py-1.5 border rounded text-sm transition-colors ${currentPage === i + 1 
                                        ? 'border-blue-600 bg-blue-600 text-white' 
                                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                הבא
                            </button>
                        </div>
                        <div className="text-sm text-slate-500 text-center md:text-right">
                            מציג {startIndex}-{endIndex} מתוך {filteredEmployees.length} עובדים
                        </div>
                    </div>
                )}
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
                                    onChange={e => handleFieldChange('name', e.target.value)}
                                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300'}`}
                                    placeholder="ישראל ישראלי"
                                />
                                {formErrors.name && (
                                    <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        <span>{formErrors.name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">אימייל *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => handleFieldChange('email', e.target.value)}
                                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-300'}`}
                                    placeholder="israel@example.com"
                                    dir="ltr"
                                />
                                {formErrors.email && (
                                    <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        <span>{formErrors.email}</span>
                                    </div>
                                )}
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
                                    onChange={e => handleFieldChange('password', e.target.value)}
                                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.password ? 'border-red-500 focus:ring-red-500' : 'border-slate-300'}`}
                                    placeholder="סיסמה זמנית"
                                    dir="ltr"
                                />
                                {formErrors.password && (
                                    <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        <span>{formErrors.password}</span>
                                    </div>
                                )}
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">תפקיד</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData(p => ({ ...p, role: e.target.value as 'manager' | 'employee' }))}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700">קבוע במשמרת בוקר</span>
                                </label>

                                {modalMode === 'edit' && (
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
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
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                                >
                                    {isSaving ? 'שומר...' : modalMode === 'create' ? 'צור עובד' : 'שמור שינויים'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {confirmDeactivate && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center text-center space-y-4" dir="rtl">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-2">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">מחיקת עובד</h2>
                        <p className="text-slate-600 text-sm">
                            האם אתה בטוח שברצונך למחוק את העובד?
                            <br />
                            פעולה זו אינה ניתנת לביטול.
                        </p>
                        <div className="flex gap-3 justify-center w-full mt-2">
                            <button
                                onClick={() => setConfirmDeactivate(null)}
                                className="flex-1 px-4 py-2.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-medium transition-colors text-sm"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleDeactivate}
                                disabled={isDeactivating}
                                className="flex-1 px-4 py-2.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                {isDeactivating ? 'מוחק...' : 'מחק עובד'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-4 py-4 rounded-xl shadow-2xl z-50 transition-all flex items-start gap-4 min-w-[320px] ${toast.type === 'success' ? 'bg-green-50 text-green-800 border-r-4 border-green-500' : 'bg-white text-slate-800 border border-slate-200 border-r-4 border-r-red-500'}`}>
                    {toast.type === 'error' && (
                        <div className="w-10 h-10 shrink-0 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                    )}
                    <div className="flex-1 pt-1">
                        <p className="font-semibold text-sm leading-tight text-slate-800">
                            {toast.text}
                        </p>
                    </div>
                    {toast.type === 'error' && (
                        <button 
                           onClick={() => setToast(null)}
                           className="text-blue-600 hover:text-blue-700 font-medium text-sm whitespace-nowrap pt-1"
                        >
                            נסה שוב
                        </button>
                    )}
                    {toast.type === 'success' && (
                        <button onClick={() => setToast(null)} className="text-green-600 hover:text-green-700 pt-1">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
