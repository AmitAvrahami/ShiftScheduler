import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { scheduleAPI, usersAPI, notificationAPI, constraintAPI } from '../../lib/api';
import { getCurrentWeekId, getWeekNumber, formatWeekDateRange } from '../../utils/weekUtils';

interface ManagerQuickInfo {
    scheduleStatus: 'not_started' | 'generated' | 'published';
    constraintSubmissionCount: number;
    pendingCount: number;
    totalActiveEmployees: number;
    shiftsTotal: number;
    shiftsFilled: number;
    missingEmployees: any[];
}

interface ActivityItem {
    id: string;
    type: 'schedule_edit' | 'constraint_approval' | 'new_employee' | 'notification' | 'constraint_submit';
    description: string;
    timestamp: Date;
}

const formatDisplayDate = (d: Date) => {
    const now = new Date();
    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).getDate() === d.getDate();
    
    // reset now
    now.setTime(new Date().getTime());

    const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    
    if (isToday) return `היום בשעה ${timeStr}`;
    if (isYesterday) return `אתמול, ${timeStr}`;
    return `${d.getDate()} ב${['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'][d.getMonth()]}, ${timeStr}`;
};

export default function ManagerDashboard() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const weekId = getCurrentWeekId();

    const [quickInfo, setQuickInfo] = useState<ManagerQuickInfo>({
        scheduleStatus: 'not_started',
        constraintSubmissionCount: 0,
        pendingCount: 0,
        totalActiveEmployees: 0,
        shiftsTotal: 0,
        shiftsFilled: 0,
        missingEmployees: []
    });
    
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [sendingReminder, setSendingReminder] = useState(false);
    
    // Shift types panel data
    const [shiftTypes, setShiftTypes] = useState<{
        morning: Record<string, number>;
        afternoon: Record<string, number>;
        night: Record<string, number>;
    }>({ morning: {}, afternoon: {}, night: {} });

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            const [scheduleRes, constraintsRes, usersRes, allSchedulesRes, notificationsRes] = await Promise.allSettled([
                scheduleAPI.getSchedule(weekId),
                constraintAPI.getWeekConstraints(weekId),
                usersAPI.getAll(),
                Promise.resolve({ data: { data: [] } }), // Mock empty schedules for manager
                notificationAPI.getAll()
            ]);

            // 1. Users
            let activeEmployees: any[] = [];
            let allUsers: any[] = [];
            if (usersRes.status === 'fulfilled') {
                allUsers = usersRes.value.data.data || [];
                activeEmployees = allUsers.filter((u: any) => u.role === 'employee' && u.isActive !== false);
            }

            // 2. Schedule
            let scheduleStatus: ManagerQuickInfo['scheduleStatus'] = 'not_started';
            let shiftsTotal = 0;
            let shiftsFilled = 0;
            const newShiftTypes = { morning: {}, afternoon: {}, night: {} } as any;
            
            if (scheduleRes.status === 'fulfilled') {
                const scheduleData = scheduleRes.value.data.data;
                scheduleStatus = scheduleData.isPublished ? 'published' : 'generated';
                
                if (scheduleData.shifts) {
                    shiftsTotal = scheduleData.shifts.length;
                    
                    const getRequiredCount = (type: string, dateStr: string) => {
                        // משתמשים ב-getDay() (local) כי התאריכים מאוחסנים
                        // כחצות ישראל ב-UTC, ו-getUTCDay() מחזיר יום שגוי
                        const day = new Date(dateStr).getDay(); // 0=Sun,...,5=Fri,6=Sat
                        const isSaturday = day === 6;
                        const isWeekend = day === 5 || day === 6;
                        
                        if (type === 'morning') return isSaturday ? 1 : 2;
                        if (type === 'afternoon') return isWeekend ? 1 : 2;
                        if (type === 'night') return 1;
                        return 1;
                    };

                    scheduleData.shifts.forEach((shift: any) => {
                        const requiredCount = getRequiredCount(shift.type, shift.date);
                        const filled = shift.employees && shift.employees.length >= requiredCount;
                        if (filled) shiftsFilled++;
                        
                        // Count for panels
                        if (shift.employees) {
                            shift.employees.forEach((emp: any) => {
                                const name = emp.name || 'לא ידוע';
                                if (!newShiftTypes[shift.type][name]) newShiftTypes[shift.type][name] = 0;
                                newShiftTypes[shift.type][name]++;
                            });
                        }
                    });
                }
            }
            setShiftTypes(newShiftTypes);

            // 3. Constraints
            let constraintSubmissionCount = 0;
            let pendingCount = 0;
            let submittedUserIds = new Set<string>();
            let allConstraints: any[] = [];
            
            if (constraintsRes.status === 'fulfilled') {
                allConstraints = constraintsRes.value.data.data || [];
                constraintSubmissionCount = allConstraints.length;
                pendingCount = allConstraints.filter((c: any) => c.isLocked === false).length;
                allConstraints.forEach((c: any) => submittedUserIds.add(c.userId._id));
            }

            const missingEmployees = activeEmployees.filter(emp => !submittedUserIds.has(emp._id));

            setQuickInfo({ 
                scheduleStatus, 
                constraintSubmissionCount, 
                pendingCount,
                totalActiveEmployees: activeEmployees.length,
                shiftsTotal,
                shiftsFilled,
                missingEmployees
            });

            // 4. Gather Activities
            let acts: ActivityItem[] = [];
            
            if (allSchedulesRes.status === 'fulfilled') {
                const sch = allSchedulesRes.value.data.data || [];
                sch.forEach((s: any) => {
                    const ts = new Date(s.updatedAt || s.createdAt);
                    acts.push({
                        id: 'sch_' + s._id,
                        type: 'schedule_edit',
                        description: `עמית ערך לוח זמנים - שבוע ${getWeekNumber(getWeekId(new Date(s.weekStartDate)))}`,
                        timestamp: ts
                    });
                });
            }
            
            allConstraints.forEach((c: any) => {
                if (c.isLocked) {
                    acts.push({
                        id: 'cl_' + c._id,
                        type: 'constraint_approval',
                        description: `שרה כהן אישרה את משמרת בוקר`, // Generic mock for now, or use exact names
                        timestamp: new Date(c.submittedAt || Date.now())
                    });
                } else {
                    acts.push({
                        id: 'cs_' + c._id,
                        type: 'constraint_submit',
                        description: `בקשת אילוץ חדשה: ${c.userId?.name || 'עובד'}`,
                        timestamp: new Date(c.submittedAt || Date.now())
                    });
                }
            });
            
            allUsers.forEach((u: any) => {
                const ts = new Date(u.createdAt);
                // Only fairly recent ones
                if (new Date().getTime() - ts.getTime() < 30 * 24 * 60 * 60 * 1000) {
                    acts.push({
                        id: 'u_' + u._id,
                        type: 'new_employee',
                        description: `נוסף עובד חדש למערכת: ${u.name}`,
                        timestamp: ts
                    });
                }
            });
            
            if (notificationsRes.status === 'fulfilled') {
                const notifs = notificationsRes.value.data.data?.notifications || [];
                notifs.forEach((n: any) => {
                    acts.push({
                        id: 'n_' + n._id,
                        type: 'notification',
                        description: n.message || `נשלחו תזכורות לכל העובדים`,
                        timestamp: new Date(n.createdAt)
                    });
                });
            }
            
            acts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setActivities(acts.slice(0, 5));

        } catch (e) {
            setHasError(true);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendReminders = async () => {
        if (quickInfo.missingEmployees.length === 0) {
            alert('אין עובדים חסרים לשליחת תזכורת.');
            return;
        }
        
        setSendingReminder(true);
        try {
            await Promise.all(quickInfo.missingEmployees.map(emp => 
                notificationAPI.create({
                    employeeId: emp._id,
                    type: 'constraint_reminder',
                    message: `אנא הגש/י אילוצים לשבוע ${getWeekNumber(weekId)} בהקדם.`
                })
            ));
            alert('התזכורות נשלחו בהצלחה.');
            await loadDashboardData(); // to refresh notifications feed
        } catch (e) {
            console.error(e);
            alert('שגיאה בשליחת תזכורות.');
        } finally {
            setSendingReminder(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const coveragePercent = quickInfo.shiftsTotal > 0 ? Math.round((quickInfo.shiftsFilled / quickInfo.shiftsTotal) * 100) : 0;
    const missingShifts = quickInfo.shiftsTotal - quickInfo.shiftsFilled;

    // Helper to get actual weekId to avoid error in UI
    const getWeekId = (dateToCheck = new Date()) => {
        const date = new Date(dateToCheck.getTime());
        date.setHours(0, 0, 0, 0);
        if (date.getDay() === 0) date.setDate(date.getDate() + 1);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    };

    if (hasError) {
        return <div className="min-h-screen flex items-center justify-center rtl">לא ניתן לטעון נתונים</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans rtl" dir="rtl">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10 w-full px-6 py-3 flex justify-between items-center h-[72px]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-blue-100 rounded-lg text-blue-600">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-blue-700 to-indigo-700">
                        ShiftScheduler
                    </span>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 text-right">
                        <div>
                            <div className="text-sm font-bold text-slate-800 leading-tight">{user?.name}</div>
                            <div className="text-xs text-slate-500 font-medium">מנהל מערכת</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex justify-center items-center overflow-hidden border border-indigo-200">
                            {user?.name ? (
                                <img 
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e0e7ff&color=4338ca&font-size=0.4`} 
                                    alt="avatar" 
                                    className="w-full h-full object-cover" 
                                />
                            ) : (
                                <span className="text-indigo-600 font-bold">מ</span>
                            )}
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleLogout}
                        className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-medium py-2 px-5 rounded-lg text-sm shadow-sm hover:shadow active:scale-95"
                    >
                        התנתקות
                    </button>
                </div>
            </header>

            <main className="max-w-[1280px] mx-auto px-6 py-8">
                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">לוח בקרה</h1>
                    <p className="text-slate-500 text-base">
                        {isLoading ? 'טוען נתונים...' : `שלום ${user?.name?.split(' ')[0] || 'מנהל'}, הנה סקירה של מצב המשמרות להיום`}
                    </p>
                </div>

                {/* Section 1: Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    
                    {/* Card 1: View Schedule Activity */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                    <line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                            </div>
                            
                            {isLoading ? (
                                <div className="h-6 flex items-center px-3 bg-slate-100 text-slate-400 rounded-full text-xs font-semibold">...</div>
                            ) : (
                                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${quickInfo.scheduleStatus === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                    {quickInfo.scheduleStatus === 'published' ? 'פורסם' : (quickInfo.scheduleStatus === 'generated' ? 'טיוטה' : 'לא נוצר')}
                                </div>
                            )}
                        </div>
                        
                        <div className="mb-6 flex-grow">
                            <h3 className="text-xl font-bold text-slate-800 mb-1">משמרות פעילות</h3>
                            <p className="text-slate-500 text-sm">שבוע {getWeekNumber(weekId)} | {formatWeekDateRange(weekId)}</p>
                        </div>
                        
                        <button 
                            onClick={() => navigate('/manager/schedule')}
                            className="w-full py-2.5 px-4 bg-white border border-slate-300 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors focus:ring-2 ring-indigo-500 ring-offset-1 outline-none"
                        >
                            ערוך לוח זמנים
                        </button>
                    </div>

                    {/* Card 2: Constraints Pending */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </div>
                            
                            {!isLoading && (
                                <div className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
                                    {quickInfo.pendingCount} ממתינים
                                </div>
                            )}
                        </div>
                        
                        <div className="mb-6 flex-grow">
                            <h3 className="text-xl font-bold text-slate-800 mb-1">הגבלות המתנות</h3>
                            <p className="text-slate-500 text-sm">בקשות עובדים שטרם אושרו</p>
                        </div>
                        
                        <div 
                            className="relative group"
                            title={quickInfo.missingEmployees.map(e => e.name).join(', ') || 'כולם הגישו'}
                        >
                            <button 
                                onClick={handleSendReminders}
                                disabled={sendingReminder || isLoading || quickInfo.missingEmployees.length === 0}
                                className="w-full py-2.5 px-4 bg-indigo-50 text-indigo-700 border border-transparent rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="w-4 h-4 text-indigo-500">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                                {sendingReminder ? 'שולח...' : 'שלח תזכורת'}
                            </button>
                        </div>
                    </div>

                    {/* Card 3: Shift Coverage */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            
                            {!isLoading && (
                                <div className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                                    {coveragePercent}%
                                </div>
                            )}
                        </div>
                        
                        <div className="mb-4 flex-grow">
                            <h3 className="text-xl font-bold text-slate-800 mb-1">כיסוי משמרות</h3>
                            <p className="text-slate-500 text-sm">עמידה ביעד המחלקתי השבועי</p>
                        </div>
                        
                        <div className="mt-auto">
                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex mb-2 shadow-inner">
                                <div 
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${coveragePercent}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-400 font-medium">
                                נותרו {missingShifts} משמרות לא מאוישות
                            </p>
                        </div>
                    </div>

                </div>

                {/* Section 2 & 3 row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                    
                    {/* Left/Middle Column: Quick Actions (Grid inside) */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        <h2 className="text-lg font-bold text-slate-800 mb-1">פעולות מהירות</h2>
                        
                        <button 
                            onClick={() => navigate('/manager/schedule/auto')}
                            className="bg-white hover:bg-slate-50 border border-slate-100 rounded-xl shadow-sm p-5 flex items-center gap-5 transition-all w-full text-right hover:-translate-y-0.5"
                        >
                            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                    <line x1="12" y1="14" x2="12" y2="18"></line>
                                    <line x1="10" y1="16" x2="14" y2="16"></line>
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-base mb-0.5">צור לוח זמנים חדש</h4>
                                <p className="text-xs text-slate-500 font-medium tracking-wide">תכנון שבועי או חודשי</p>
                            </div>
                        </button>
                        
                        <button 
                            onClick={() => navigate('/manager/employees')}
                            className="bg-white hover:bg-slate-50 border border-slate-100 rounded-xl shadow-sm p-5 flex items-center gap-5 transition-all w-full text-right hover:-translate-y-0.5"
                        >
                            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-base mb-0.5">הצג עובדים</h4>
                                <p className="text-xs text-slate-500 font-medium tracking-wide">ניהול צוות והרשאות</p>
                            </div>
                        </button>

                        <button 
                            onClick={() => navigate('/manager/constraints')}
                            className="bg-white hover:bg-slate-50 border border-slate-100 rounded-xl shadow-sm p-5 flex items-center gap-5 transition-all w-full text-right hover:-translate-y-0.5"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-base mb-0.5">אילוצי עובדים</h4>
                                <p className="text-xs text-slate-500 font-medium tracking-wide">ניהול ואישור בקשות זמינות</p>
                            </div>
                        </button>
                    </div>

                    {/* Right Column (2 spans): Activity feed */}
                    <div className="lg:col-span-2 flex flex-col">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 pl-2">פעילות אחרונה</h2>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
                            {isLoading ? (
                                <div className="p-8 text-center text-slate-400">טוען...</div>
                            ) : activities.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 font-medium">אין פעילויות להציג</div>
                            ) : (
                                <div className="flex-grow">
                                    {activities.map((act, index) => {
                                        // Pick icon and color depending on type
                                        let icon = null;
                                        let colorClass = 'bg-slate-100 text-slate-500';
                                        
                                        if (act.type === 'schedule_edit') {
                                            colorClass = 'bg-blue-100 text-blue-600';
                                            icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />;
                                        } else if (act.type === 'constraint_approval') {
                                            colorClass = 'bg-emerald-100 text-emerald-600';
                                            icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />;
                                        } else if (act.type === 'constraint_submit') {
                                            colorClass = 'bg-amber-100 text-amber-600';
                                            icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />;
                                        } else if (act.type === 'new_employee') {
                                            colorClass = 'bg-purple-100 text-purple-600';
                                            icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />;
                                        } else {
                                            colorClass = 'bg-slate-100 text-slate-600';
                                            icon = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />;
                                        }

                                        return (
                                            <div key={act.id} className={`flex items-center gap-5 p-5 ${index !== activities.length - 1 ? 'border-b border-slate-50' : ''} hover:bg-slate-50/50 transition-colors group`}>
                                                <div className="w-24 shrink-0 text-left text-xs font-semibold text-slate-400 group-hover:text-slate-500 transition-colors">
                                                    {formatDisplayDate(act.timestamp)}
                                                </div>
                                                <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
                                                <div className="flex-grow font-semibold text-slate-700 text-sm">{act.description}</div>
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
                                                        {icon}
                                                    </svg>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            <div className="mt-auto border-t border-slate-100">
                                <a href="#" onClick={(e) => e.preventDefault()} className="block text-center py-3.5 text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:bg-slate-50 rounded-b-2xl transition-colors">
                                    צפה בכל הפעילויות
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 4: Shift Types */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 pl-2">תצוגת סוגי משמרות</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Morning */}
                        <div className="bg-sky-50 rounded-2xl p-5 border border-sky-100">
                            <h3 className="font-bold text-sky-800 text-lg mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-sky-500"></span> בוקר
                            </h3>
                            <ul className="space-y-2">
                                {Object.entries(shiftTypes.morning).length === 0 ? (
                                    <li className="text-sm text-sky-600/60 font-medium">אין משמרות בוקר מוקצות</li>
                                ) : (
                                    Object.entries(shiftTypes.morning).map(([name, count]) => (
                                        <li key={name} className="flex justify-between items-center text-sm">
                                            <span className="font-semibold text-slate-700">{name}</span>
                                            <span className="text-xs bg-white text-sky-700 font-bold px-2 py-1 rounded shadow-sm">
                                                {count} משמרות
                                            </span>
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>

                        {/* Afternoon */}
                        <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100">
                            <h3 className="font-bold text-orange-800 text-lg mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span> אחה״צ
                            </h3>
                            <ul className="space-y-2">
                                {Object.entries(shiftTypes.afternoon).length === 0 ? (
                                    <li className="text-sm text-orange-600/60 font-medium">אין משמרות צהריים מוקצות</li>
                                ) : (
                                    Object.entries(shiftTypes.afternoon).map(([name, count]) => (
                                        <li key={name} className="flex justify-between items-center text-sm">
                                            <span className="font-semibold text-slate-700">{name}</span>
                                            <span className="text-xs bg-white text-orange-700 font-bold px-2 py-1 rounded shadow-sm">
                                                {count} משמרות
                                            </span>
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>

                        {/* Night */}
                        <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
                            <h3 className="font-bold text-purple-800 text-lg mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span> לילה
                            </h3>
                            <ul className="space-y-2">
                                {Object.entries(shiftTypes.night).length === 0 ? (
                                    <li className="text-sm text-purple-600/60 font-medium">אין משמרות לילה מוקצות</li>
                                ) : (
                                    Object.entries(shiftTypes.night).map(([name, count]) => (
                                        <li key={name} className="flex justify-between items-center text-sm">
                                            <span className="font-semibold text-slate-700">{name}</span>
                                            <span className="text-xs bg-white text-purple-700 font-bold px-2 py-1 rounded shadow-sm">
                                                {count} משמרות
                                            </span>
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>

                    </div>
                </div>

                {/* Footer simple space filler */}
                <div className="py-6 border-t border-slate-200 flex justify-between items-center text-xs text-slate-400 mt-12 pb-8">
                    <span>© {new Date().getFullYear()} ShiftScheduler. All rights reserved.</span>
                    <div className="flex gap-4 font-semibold">
                        <span>גרסה 2.4.0</span>
                        <span className="text-indigo-600">ShiftScheduler</span>
                    </div>
                </div>

            </main>
        </div>
    );
}
