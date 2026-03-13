import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { scheduleAPI } from '../../lib/api';
import { getCurrentWeekId, getWeekNumber, formatWeekDateRange } from '../../utils/weekUtils';
import NotificationBell from '../../components/NotificationBell';
import api from '../../lib/api';

interface ManagerQuickInfo {
    scheduleStatus: 'not_started' | 'generated' | 'published';
    constraintSubmissionCount: number;
    totalActiveEmployees: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    not_started: { label: 'לא נוצר', color: 'text-gray-500' },
    generated: { label: 'טיוטה - לא פורסם', color: 'text-amber-600' },
    published: { label: 'פורסם ✓', color: 'text-green-600' },
};

/**
 * Manager dashboard with quick info cards:
 * - "סטטוס סידור השבוע" — Generated / Published / Not started
 * - "עובדים שהגישו אילוצים" — X out of N employees
 */
export default function ManagerDashboard() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [quickInfo, setQuickInfo] = useState<ManagerQuickInfo>({
        scheduleStatus: 'not_started',
        constraintSubmissionCount: 0,
        totalActiveEmployees: 0,
    });
    const [isLoadingQuickInfo, setIsLoadingQuickInfo] = useState(true);
    const weekId = getCurrentWeekId();

    useEffect(() => {
        loadQuickInfo();
    }, []);

    const loadQuickInfo = async () => {
        setIsLoadingQuickInfo(true);
        try {
            const [scheduleRes, constraintsRes, usersRes] = await Promise.allSettled([
                scheduleAPI.getSchedule(weekId),
                api.get(`/constraints/week/${weekId}`),
                api.get('/users'),
            ]);

            // Determine schedule status
            let scheduleStatus: ManagerQuickInfo['scheduleStatus'] = 'not_started';
            if (scheduleRes.status === 'fulfilled') {
                const scheduleData = scheduleRes.value.data.data;
                scheduleStatus = scheduleData.isPublished ? 'published' : 'generated';
            }

            // Count constraint submissions
            let constraintSubmissionCount = 0;
            if (constraintsRes.status === 'fulfilled') {
                constraintSubmissionCount = constraintsRes.value.data.data?.length ?? 0;
            }

            // Count total active employees
            let totalActiveEmployees = 0;
            if (usersRes.status === 'fulfilled') {
                totalActiveEmployees = (usersRes.value.data.data || [])
                    .filter((u: any) => u.role !== 'manager').length;
            }

            setQuickInfo({ scheduleStatus, constraintSubmissionCount, totalActiveEmployees });
        } catch {
            // Non-critical
        } finally {
            setIsLoadingQuickInfo(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-100" dir="rtl">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">מערכת סידור משמרות</h1>
                    <div className="flex items-center gap-4">
                        <Link to="/manager/constraints" className="text-blue-600 hover:text-blue-800 font-medium">ניהול אילוצים</Link>
                        <Link to="/constraints" className="text-blue-600 hover:text-blue-800 font-medium">האילוצים שלי</Link>
                        <Link to="/manager/schedule" className="text-blue-600 hover:text-blue-800 font-medium">ניהול סידור</Link>
                        <Link to="/manager/employees" className="text-blue-600 hover:text-blue-800 font-medium">ניהול עובדים</Link>
                        <Link to="/schedule" className="text-blue-600 hover:text-blue-800 font-medium">סידור עבודה</Link>
                        <NotificationBell />
                        <span className="text-gray-700">שלום, {user?.name}</span>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
                        >
                            התנתק
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                {/* Quick Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Schedule Status Card */}
                    <div className="bg-white rounded-xl shadow p-6 border-r-4 border-indigo-500">
                        <p className="text-sm font-medium text-gray-500 mb-1">סטטוס סידור השבוע</p>
                        {isLoadingQuickInfo ? (
                            <p className="text-gray-400 text-sm">טוען...</p>
                        ) : (
                            <p className={`text-xl font-bold ${STATUS_LABELS[quickInfo.scheduleStatus].color}`}>
                                {STATUS_LABELS[quickInfo.scheduleStatus].label}
                            </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">שבוע {getWeekNumber(weekId)} | {formatWeekDateRange(weekId)}</p>
                    </div>

                    {/* Constraints Submissions Card */}
                    <div className="bg-white rounded-xl shadow p-6 border-r-4 border-green-500">
                        <p className="text-sm font-medium text-gray-500 mb-1">עובדים שהגישו אילוצים</p>
                        {isLoadingQuickInfo ? (
                            <p className="text-gray-400 text-sm">טוען...</p>
                        ) : (
                            <p className="text-2xl font-bold text-green-700">
                                {quickInfo.constraintSubmissionCount}
                                <span className="text-base font-normal text-gray-400 mr-1">
                                    מתוך {quickInfo.totalActiveEmployees}
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Welcome Card */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">לוח בקרה - מנהל</h2>
                    <p className="text-gray-600">ברוך הבא למערכת!</p>
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <p className="font-semibold">פרטי משתמש:</p>
                        <p>שם: {user?.name}</p>
                        <p>אימייל: {user?.email}</p>
                        <p>תפקיד: מנהל</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
