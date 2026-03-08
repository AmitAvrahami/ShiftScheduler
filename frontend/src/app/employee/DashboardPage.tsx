import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { scheduleAPI } from '../../lib/api';
import { getCurrentWeekId, getWeekDates, getWeekId } from '../../utils/weekUtils';
import NotificationBell from '../../components/NotificationBell';
import api from '../../lib/api';

interface QuickInfo {
    nextShift: { date: string; type: string } | null;
    constraintsCount: number;
}

const SHIFT_LABELS: Record<string, string> = {
    morning: 'בוקר',
    afternoon: 'צהריים',
    night: 'לילה',
};

/**
 * Employee dashboard with quick info cards:
 * - "המשמרת הבאה שלי" — fetched from the published schedule
 * - "אילוצים שהגשתי השבוע" — count of submitted constraints
 */
export default function EmployeeDashboard() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [quickInfo, setQuickInfo] = useState<QuickInfo>({ nextShift: null, constraintsCount: 0 });
    const [isLoadingQuickInfo, setIsLoadingQuickInfo] = useState(true);
    const weekId = getCurrentWeekId();

    useEffect(() => {
        loadQuickInfo();
    }, []);

    const loadQuickInfo = async () => {
        setIsLoadingQuickInfo(true);
        try {
            const currentWeekDates = getWeekDates(weekId);
            const nextSunday = new Date(currentWeekDates[0].getTime() + 7 * 24 * 60 * 60 * 1000);
            const nextWeekId = getWeekId(nextSunday);

            const [scheduleRes, nextScheduleRes, constraintsRes] = await Promise.allSettled([
                scheduleAPI.getMySchedule(weekId),
                scheduleAPI.getMySchedule(nextWeekId),
                api.get(`/constraints/my/${weekId}`),
            ]);

            let allShifts: Array<{ date: string; type: string }> = [];
            if (scheduleRes.status === 'fulfilled') {
                allShifts = allShifts.concat(scheduleRes.value.data.data || []);
            }
            if (nextScheduleRes.status === 'fulfilled') {
                allShifts = allShifts.concat(nextScheduleRes.value.data.data || []);
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let nextShift = null;
            if (allShifts.length > 0) {
                const upcoming = allShifts
                    .map(s => {
                        const d = new Date(s.date);
                        d.setHours(0, 0, 0, 0);
                        return { ...s, dateObj: d };
                    })
                    .filter(s => s.dateObj >= today)
                    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
                nextShift = upcoming[0] ?? null;
            }

            let constraintsCount = 0;
            if (constraintsRes.status === 'fulfilled') {
                constraintsCount = constraintsRes.value.data.data?.constraints?.length ?? 0;
            }

            setQuickInfo({ nextShift, constraintsCount });
        } catch {
            // Quick info is non-critical
        } finally {
            setIsLoadingQuickInfo(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const formatShiftDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const weekday = date.toLocaleDateString('he-IL', { weekday: 'long' });
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${weekday} ${day}/${month}`;
    };

    return (
        <div className="min-h-screen bg-gray-100" dir="rtl">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">מערכת סידור משמרות</h1>
                    <div className="flex items-center gap-4">
                        <Link to="/constraints" className="text-blue-600 hover:text-blue-800 font-medium">הגשת אילוצים</Link>
                        <Link to="/schedule" className="text-blue-600 hover:text-blue-800 font-medium">סידור עבודה</Link>
                        <Link to="/schedule/my" className="text-blue-600 hover:text-blue-800 font-medium">המשמרות שלי</Link>
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
                    {/* Next Shift Card */}
                    <div className="bg-white rounded-xl shadow p-6 border-r-4 border-blue-500">
                        <p className="text-sm font-medium text-gray-500 mb-1">המשמרת הבאה שלי</p>
                        {isLoadingQuickInfo ? (
                            <p className="text-gray-400 text-sm">טוען...</p>
                        ) : quickInfo.nextShift ? (
                            <div>
                                <p className="text-lg font-bold text-gray-800">
                                    {SHIFT_LABELS[quickInfo.nextShift.type]}
                                </p>
                                <p className="text-sm text-gray-500">{formatShiftDate(quickInfo.nextShift.date)}</p>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">אין משמרות קרובות</p>
                        )}
                    </div>

                    {/* Constraints Card */}
                    <div className="bg-white rounded-xl shadow p-6 border-r-4 border-indigo-500">
                        <p className="text-sm font-medium text-gray-500 mb-1">אילוצים שהגשתי השבוע</p>
                        {isLoadingQuickInfo ? (
                            <p className="text-gray-400 text-sm">טוען...</p>
                        ) : (
                            <p className="text-2xl font-bold text-indigo-700">{quickInfo.constraintsCount}</p>
                        )}
                    </div>
                </div>

                {/* Welcome Card */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">לוח בקרה - עובד</h2>
                    <p className="text-gray-600">ברוך הבא למערכת!</p>
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <p className="font-semibold">פרטי משתמש:</p>
                        <p>שם: {user?.name}</p>
                        <p>אימייל: {user?.email}</p>
                        <p>תפקיד: עובד</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
