import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { scheduleAPI, ConstraintViolationReport, PartialAssignment } from '../lib/api';
import { getCurrentWeekId, getWeekDates, formatWeekDateRange, getWeekId } from '../utils/weekUtils';

const SHIFT_TYPES = [
    { id: 'morning', label: 'בוקר', time: '07:00 - 15:00', icon: '🌅' },
    { id: 'afternoon', label: 'ערב', time: '15:00 - 23:00', icon: '🌇' },
    { id: 'night', label: 'לילה', time: '23:00 - 07:00', icon: '🌙' },
] as const;

const SHIFT_LABELS: Record<string, string> = {
    morning: 'בוקר',
    afternoon: 'צהריים',
    night: 'לילה',
};

const METRIC_LABELS: Record<string, string> = {
    nightShifts: 'משמרות לילה',
    weekendShifts: 'משמרות סוף שבוע',
};

const ACTION_LABELS: Record<string, string> = {
    cover_start: 'דרוש כיסוי תחילת משמרת',
    cover_end: 'דרוש כיסוי סיום משמרת',
};

function formatDateKey(dateKey: string): string {
    const d = new Date(dateKey + 'T00:00:00');
    const dayName = d.toLocaleDateString('he-IL', { weekday: 'long' });
    return `${dayName} ${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * Manages the Multi-step Automated Scheduler Wizard.
 * 
 * "I recommend the Strategy Pattern here because:
 * 1. We have multiple distinct steps in the wizard (Settings, Preview, Finish)
 * 2. Each step has entirely different rendering and validation logic
 * 3. We need to switch between them seamlessly based on state
 * 4. It keeps the main container component clean and delegates rendering to specific step function components"
 */

// ─── Types and State ────────────────────────────────────────────────────────
type WizardStep = 'SETTINGS' | 'LOADING' | 'PREVIEW' | 'FINISH';

interface SchedulerConfig {
    avoidConsecutive: boolean;
    fairRotation: boolean;
    respectConstraints: boolean;
}

export default function AutomatedSchedulerPage() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<WizardStep>('SETTINGS');
    
    // Settings configuration
    const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekId());
    const [config, setConfig] = useState<SchedulerConfig>({
        avoidConsecutive: true,
        fairRotation: true,
        respectConstraints: true,
    });

    // Schedule Payload from backend
    const [generatedSchedule, setGeneratedSchedule] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // ─── Actions ─────────────────────────────────────────────────────────────
    
    /**
     * Executes the backend shift generation API
     * 
     * @returns {Promise<void>}
     */
    const handleGenerate = async () => {
        setCurrentStep('LOADING');
        setError(null);
        try {
            const res = await scheduleAPI.generate(selectedWeek);
            setGeneratedSchedule(res.data.data); // Adjust depending on actual API response wrapper
            
            // Artificial delay to show high-end loading, because calculating 
            // takes a moment and user perception is important (per req).
            setTimeout(() => {
                setCurrentStep('PREVIEW');
            }, 1000);
            
        } catch (err: any) {
            console.error('Generation Error:', err);
            setError(err.response?.data?.message || 'שגיאה ביצירת סידור משמרות');
            setCurrentStep('SETTINGS'); // Revert
        }
    };

    /**
     * Navigates back to steps
     */
    const goBackToSettings = () => setCurrentStep('SETTINGS');

    // ─── Render Strategies ────────────────────────────────────────────────────
    
    const renderStepContent = () => {
        switch (currentStep) {
            case 'SETTINGS':
                return (
                    <SettingsStrategy 
                        selectedWeek={selectedWeek} 
                        setSelectedWeek={setSelectedWeek} 
                        config={config} 
                        setConfig={setConfig} 
                        onGenerate={handleGenerate} 
                        error={error} 
                    />
                );
            case 'LOADING':
                return <LoadingStrategy />;
            case 'PREVIEW':
                return (
                    <PreviewStrategy
                        scheduleData={generatedSchedule?.schedule}
                        weekId={selectedWeek}
                        constraintViolationReport={generatedSchedule?.constraintViolationReport}
                        partialAssignments={generatedSchedule?.partialAssignments}
                        warnings={generatedSchedule?.warnings}
                        onEdit={() => navigate(`/manager/schedule?weekId=${selectedWeek}`)}
                        onApprove={async () => {
                            try {
                                // Auto-generation endpoint usually saves a draft in DB.
                                // Calling publish explicitly makes it live:
                                await scheduleAPI.publish(selectedWeek);
                                setCurrentStep('FINISH');
                            } catch (err) {
                                console.error('Error publishing schedule', err);
                                alert('אירעה שגיאה בפרסום הסידור. נסה שוב.');
                            }
                        }}
                        onBack={goBackToSettings}
                    />
                );
            case 'FINISH':
                return <FinishStrategy onFinish={() => navigate('/dashboard')} selectedWeek={selectedWeek} />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans rtl flex flex-col items-center" dir="rtl">
            {/* Header/Stepper Strip */}
            <header className="bg-white border-b border-slate-200 w-full px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="text-slate-500 hover:text-slate-800 transition-colors p-2 rounded-full hover:bg-slate-100"
                        title="חזרה ללוח בקרה"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-indigo-600 to-blue-600">
                        יצירת סידור חכם
                    </h1>
                </div>

                {/* Stepper Display */}
                <div className="flex items-center gap-8 px-4 text-sm font-medium">
                    <StepperItem stepNum={1} label="הגדרות" active={currentStep === 'SETTINGS' || currentStep === 'LOADING'} completed={currentStep === 'PREVIEW' || currentStep === 'FINISH'} />
                    <StepperDivider />
                    <StepperItem stepNum={2} label="סקירה" active={currentStep === 'PREVIEW'} completed={currentStep === 'FINISH'} />
                    <StepperDivider />
                    <StepperItem stepNum={3} label="סיום" active={currentStep === 'FINISH'} completed={false} />
                </div>
                
                <div className="w-12"></div> {/* spacer for center alignment */}
            </header>

            <main className="w-full max-w-5xl flex-grow p-6 sm:p-8 flex flex-col relative">
                {renderStepContent()}
            </main>
        </div>
    );
}

// ─── Strategy Components ──────────────────────────────────────────────────

/**
 * Renders the Settings Step
 */
function SettingsStrategy({ 
    selectedWeek, 
    setSelectedWeek, 
    config, 
    setConfig, 
    onGenerate,
    error
}: { 
    selectedWeek: string, 
    setSelectedWeek: (val: string) => void, 
    config: SchedulerConfig, 
    setConfig: (val: SchedulerConfig) => void, 
    onGenerate: () => void,
    error: string | null
}) {
    // Week date navigation
    const weekDates = useMemo(() => {
        try {
            return getWeekDates(selectedWeek);
        } catch {
            return [];
        }
    }, [selectedWeek]);

    const handlePrevWeek = () => {
        if (weekDates.length > 0) {
            const prevSunday = new Date(weekDates[0].getTime() - 7 * 24 * 60 * 60 * 1000);
            setSelectedWeek(getWeekId(prevSunday));
        }
    };

    const handleNextWeek = () => {
        if (weekDates.length > 0) {
            const nextSunday = new Date(weekDates[0].getTime() + 7 * 24 * 60 * 60 * 1000);
            setSelectedWeek(getWeekId(nextSunday));
        }
    };

    const toggleConfig = (key: keyof SchedulerConfig) => {
        setConfig({ ...config, [key]: !config[key] });
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mt-4">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">הגדרת שיבוץ אוטומטי</h2>
                <p className="text-slate-500 font-medium">המנוע החכם יתחשב באילוצים ובצרכי המערכת כדי לבנות את הסידור הטוב ביותר.</p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl shadow-sm font-medium">
                    ⚠️ {error}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
                
                {/* Week Picker */}
                <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">בחר שבוע לשיבוץ</h3>
                    <div className="flex items-center justify-between border border-slate-200 rounded-xl p-2 bg-slate-50">
                        <button onClick={handleNextWeek} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <div className="text-base font-bold text-slate-800 text-center uppercase">
                            {formatWeekDateRange(selectedWeek)}
                        </div>
                        <button onClick={handlePrevWeek} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    </div>
                </div>

                <div className="my-6 border-b border-slate-100"></div>

                {/* Constraints Config */}
                <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">הנחיות לאלגוריתם</h3>
                    <div className="space-y-3">
                        <CheckboxCard 
                            checked={config.avoidConsecutive} 
                            onChange={() => toggleConfig('avoidConsecutive')} 
                            title="המנע ממשמרות ברצף" 
                            desc="המערכת תמנע מלשבץ עובד יותר מ-2 משמרות ברצף אם ניתן."
                            icon="🛡️"
                        />
                        <CheckboxCard 
                            checked={config.fairRotation} 
                            onChange={() => toggleConfig('fairRotation')} 
                            title="עדיפות לרוטציה הוגנת" 
                            desc="חלוקה מאוזנת של משמרות ערב/לילה בין כלל העובדים הפעילים."
                            icon="⚖️"
                        />
                        <CheckboxCard 
                            checked={config.respectConstraints} 
                            onChange={() => toggleConfig('respectConstraints')} 
                            title="התחשבות מירבית באילוצים" 
                            desc="הימנעות משיבוץ עובדים כשיש חפיפה עם אילוצים מצולבים, גם במחיר של משמרות חסרות."
                            icon="🤝"
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={onGenerate}
                        className="group w-full flex items-center justify-center gap-3 bg-gradient-to-l from-indigo-600 to-blue-600 text-white text-lg font-bold p-4 rounded-xl shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all"
                    >
                        <span>הפק לוח זמנים</span>
                        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 group-hover:rotate-12 transition-transform" stroke="currentColor" strokeWidth="2">
                            <path d="M10 2l1.66 4.67 4.67 1.66-4.67 1.66L10 14.66 8.34 10 3.67 8.34 8.34 6.67z" />
                            <path d="M18.66 12L18 14l-2 .66 2 .66.66 2 .66-2 2-.66-2-.66z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Loading Overlay Strategy (Enterprise style)
 */
function LoadingStrategy() {
    return (
        <div className="flex-grow flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-24 h-24 relative mb-8">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">המערכת מחשבת אלפי אפשרויות כדי למצוא את הסידור האופטימלי...</h2>
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full font-semibold border border-indigo-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 animate-pulse"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Enterprise v2.1 Optimization Engine</span>
            </div>
        </div>
    );
}

/**
 * Preview Strategy
 */
function PreviewStrategy({
    scheduleData,
    weekId,
    constraintViolationReport,
    partialAssignments,
    warnings,
    onEdit,
    onApprove,
    onBack
}: {
    scheduleData: any,
    weekId: string,
    constraintViolationReport?: ConstraintViolationReport,
    partialAssignments?: PartialAssignment[],
    warnings?: string[],
    onEdit: () => void,
    onApprove: () => void,
    onBack: () => void
}) {
    // Basic date calculations for the grid headers
    const weekDates = useMemo(() => {
        try {
            return getWeekDates(weekId);
        } catch {
            return [];
        }
    }, [weekId]);

    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    // Derived KPI values
    const report = constraintViolationReport;
    const criticalViolations = report?.criticalViolations ?? [];
    const sequenceWarnings = report?.sequenceWarnings ?? [];
    const fairnessWarnings = report?.fairnessWarnings ?? [];
    const softWarnings = report?.softWarnings ?? [];
    const totalViolations = report?.totalViolations ?? 0;

    const coverageLabel = criticalViolations.length === 0 ? '100%' : `${criticalViolations.length} חסרות`;
    const coverageIsGood = criticalViolations.length === 0;

    const fairnessScore = fairnessWarnings.length === 0
        ? 100
        : Math.max(0, 100 - Math.round(
            fairnessWarnings.reduce((sum, w) => sum + w.deviationPercent, 0) / fairnessWarnings.length
          ));

    // Deduplicated partials: softWarnings + extras from top-level partialAssignments
    const partialKey = (p: PartialAssignment) => `${p.employeeName}-${p.dateKey}-${p.shiftType}`;
    const softKeys = new Set(softWarnings.map(partialKey));
    const extraPartials = (partialAssignments ?? []).filter(p => !softKeys.has(partialKey(p)));
    const dedupedPartials = [...softWarnings, ...extraPartials];

    const totalCards = criticalViolations.length + sequenceWarnings.length + fairnessWarnings.length + dedupedPartials.length + (warnings?.length ?? 0);

    // Helper to find employees for a specific cell
    const getCellEmployees = (dateStr: string, type: string) => {
        if (!scheduleData?.shifts) return [];
        const shift = scheduleData.shifts.find((s: any) => 
            s.date.split('T')[0] === dateStr.split('T')[0] && s.type === type
        );
        return shift?.employees || [];
    };

    return (
        <div className="w-full animate-in fade-in duration-500 flex flex-col items-center">
            
            {/* Header / Actions */}
            <div className="w-full flex-col sm:flex-row flex sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">סקירת שיבוץ אוטומטי</h2>
                    <p className="text-slate-500 text-sm">המערכת השלימה את השיבוץ בהצלחה. ניתן לאשר או לערוך ידנית.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={onBack}
                        className="px-5 py-2 min-w-24 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors"
                    >
                        ביטול
                    </button>
                    <button 
                        onClick={onEdit}
                        className="px-5 py-2 min-w-24 bg-white border border-indigo-200 text-indigo-700 rounded-xl font-bold shadow-sm hover:bg-indigo-50 transition-colors"
                    >
                        עריכה במערכת
                    </button>
                    <button 
                        onClick={onApprove}
                        className="px-5 py-2 min-w-32 bg-indigo-600 text-white rounded-xl font-bold shadow-sm shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>שמירה ופרסום</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 mb-1">כיסוי משמרות</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-800">{coverageLabel}</span>
                            <span className={`text-sm font-semibold px-2 rounded ${coverageIsGood ? 'text-emerald-500 bg-emerald-50' : 'text-amber-500 bg-amber-50'}`}>
                                {coverageIsGood ? 'מלא' : 'חלקי'}
                            </span>
                        </div>
                    </div>
                    <div className={`w-12 h-12 rounded-full border flex items-center justify-center ${coverageIsGood ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-500'}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 mb-1">חריגות אילוצים</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-800">{totalViolations}</span>
                            <span className={`text-sm font-semibold px-2 rounded ${totalViolations === 0 ? 'text-emerald-500 bg-emerald-50' : 'text-amber-500 bg-amber-50'}`}>
                                {totalViolations === 0 ? 'תקין' : 'אזהרות'}
                            </span>
                        </div>
                    </div>
                    <div className={`w-12 h-12 rounded-full border flex items-center justify-center ${totalViolations === 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-500'}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 mb-1">מדד הוגנות חלוקה</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-800">{fairnessScore}</span>
                            <span className="text-sm font-semibold text-slate-500">/ 100</span>
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                </div>
            </div>

            {/* Grid UI */}
            <div className="w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200 pb-2">
                <div className="min-w-[800px]">
                    {/* Headers */}
                    <div className="grid grid-cols-8 divide-x divide-x-reverse border-b border-slate-200 bg-slate-50">
                        <div className="p-4 flex items-center justify-center">
                            <span className="text-sm font-bold text-slate-400">משמרת \ יום</span>
                        </div>
                        {weekDates.map((date, idx) => {
                            const dateStr = date.toISOString().split('T')[0];
                            const isWeekend = idx === 5 || idx === 6;
                            return (
                                <div key={dateStr} className={`p-3 text-center ${isWeekend ? 'bg-indigo-50/50' : ''}`}>
                                    <div className={`font-bold text-sm ${isWeekend ? 'text-indigo-700' : 'text-slate-700'}`}>
                                        {days[idx]}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5 font-medium">
                                        {date.getDate()}/{date.getMonth() + 1}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Rows */}
                    {SHIFT_TYPES.map((shiftType) => (
                        <div key={shiftType.id} className="grid grid-cols-8 divide-x divide-x-reverse border-b border-slate-100 last:border-0 hover:bg-slate-50/30 transition-colors">
                            
                            {/* Row Header */}
                            <div className="p-4 flex flex-col justify-center items-center text-center bg-slate-50/50">
                                <span className="text-xl mb-1" title={shiftType.label}>{shiftType.icon}</span>
                                <span className="text-sm font-bold text-slate-700">{shiftType.label}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{shiftType.time}</span>
                            </div>

                            {/* Cells */}
                            {weekDates.map((date, idx) => {
                                const dateStr = date.toISOString();
                                const emps = getCellEmployees(dateStr, shiftType.id);
                                const isWeekend = idx === 5 || idx === 6;

                                return (
                                    <div key={`${dateStr}-${shiftType.id}`} className={`p-2 relative group flex flex-col gap-1.5 ${isWeekend ? 'bg-indigo-50/10' : ''}`}>
                                        {emps.length === 0 ? (
                                            <div className="w-full h-12 flex items-center justify-center text-slate-300">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-5 h-5 opacity-50"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                            </div>
                                        ) : (
                                            emps.map((emp: any, i: number) => (
                                                <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:shadow">
                                                    <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] shrink-0 text-slate-500">
                                                        {emp.name ? emp.name.charAt(0) : 'U'}
                                                    </div>
                                                    <span className="truncate flex-grow">{emp.name || 'עובד'}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Info Note + Violations Panel */}
            <div className="w-full mt-6 flex flex-col gap-4">
                {/* Info Note */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 flex items-start gap-3">
                    <div className="text-blue-500 mt-0.5 shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </div>
                    <div className="text-sm text-blue-800">
                        <p className="font-bold mb-1">הערה לגבי הסידור</p>
                        <p className="opacity-80 leading-relaxed">השיבוץ מוצג כטיוטה (Preview) ולא פורסם לעובדים. לשמירה סופית או שליחת הודעות יש ללחוץ על "שמירה ופרסום", או לערוך ידנית את השיבוץ אם נדרשים שינויים מדויקים יותר. משמרות מסומנות יוצגו אם חוברו חריגות באילוצי עובדים.</p>
                    </div>
                </div>

                {/* Violations Panel */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                        <span className={totalCards === 0 ? 'text-emerald-500' : 'text-amber-500'}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </span>
                        <h3 className="font-bold text-slate-800">אזהרות וחריגות</h3>
                        {totalCards > 0 && (
                            <span className="mr-auto text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                                {totalCards} פריטים
                            </span>
                        )}
                    </div>

                    {totalCards === 0 && (
                        <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            <p className="text-sm font-semibold">אין חריגות — הסידור עומד בכל האילוצים!</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        {/* Critical Violations — red */}
                        {criticalViolations.map((v, i) => (
                            <ViolationCard
                                key={`crit-${i}`}
                                color="red"
                                title={`משמרת חסרה — ${SHIFT_LABELS[v.shiftType] ?? v.shiftType}`}
                                body={`${formatDateKey(v.dateKey)} | שובצו ${v.filled}/${v.required} | חסרים ${v.missing} עובדים`}
                                badge={v.reason === 'capacity_limit' ? 'מגבלת קיבולת' : undefined}
                            />
                        ))}

                        {/* Sequence Warnings — orange */}
                        {sequenceWarnings.map((w, i) => (
                            <ViolationCard
                                key={`seq-${i}`}
                                color="orange"
                                title={`${w.employeeName} — הפרת מנוחה`}
                                body={`משמרת ${SHIFT_LABELS[w.fromShift] ?? w.fromShift} ב${formatDateKey(w.fromDate)} → משמרת ${SHIFT_LABELS[w.toShift] ?? w.toShift} ב${formatDateKey(w.toDate)} | מנוחה בפועל: ${w.restHours} שעות (נדרש 11)`}
                            />
                        ))}

                        {/* Fairness Warnings — yellow */}
                        {fairnessWarnings.map((w, i) => (
                            <ViolationCard
                                key={`fair-${i}`}
                                color="yellow"
                                title={`${w.employeeName} — עומס לא מאוזן`}
                                body={`${METRIC_LABELS[w.metric] ?? w.metric}: ${w.employeeCount} (ממוצע: ${w.averageCount}) | חריגה של ${w.deviationPercent}% מהממוצע`}
                            />
                        ))}

                        {/* Partial Assignments (deduped softWarnings + partialAssignments) — blue */}
                        {dedupedPartials.map((p, i) => (
                            <ViolationCard
                                key={`partial-${i}`}
                                color="blue"
                                title={`${p.employeeName} — זמינות חלקית`}
                                body={`משמרת ${SHIFT_LABELS[p.shiftType] ?? p.shiftType} ב${formatDateKey(p.dateKey)} | ${p.gapDescription} | ${ACTION_LABELS[p.action] ?? p.action}`}
                            />
                        ))}

                        {/* Plain warnings strings — gray */}
                        {(warnings ?? []).map((w, i) => (
                            <ViolationCard
                                key={`warn-${i}`}
                                color="gray"
                                title={w}
                            />
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}

/**
 * Finish Strategy
 */
function FinishStrategy({ onFinish, selectedWeek }: { onFinish: () => void, selectedWeek: string }) {
    return (
        <div className="w-full flex-grow flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm border-4 border-emerald-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-12 h-12"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">הסידור פורסם בהצלחה!</h2>
            <p className="text-lg text-slate-500 mb-10 max-w-md text-center">
                הסידור לשבוע {formatWeekDateRange(selectedWeek)} נשמר במערכת. הודעת פוש ואימייל ישלחו כעת לכלל העובדים המשובצים.
            </p>
            <button 
                onClick={onFinish}
                className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg hover:bg-slate-700 hover:-translate-y-1 transition-all"
            >
                חזרה ללוח בקרת מנהל
            </button>
        </div>
    );
}

// ─── Shared Tooling ───────────────────────────────────────────────────────

function CheckboxCard({ checked, onChange, title, desc, icon }: { checked: boolean, onChange: () => void, title: string, desc: string, icon: string }) {
    return (
        <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}>
            <div className={`w-6 h-6 shrink-0 rounded flex items-center justify-center border mt-0.5 transition-colors ${checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
                {checked && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
            <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800">{title}</span>
                    <span className="text-sm bg-white border border-slate-200 shadow-sm px-1.5 py-0.5 rounded leading-none">{icon}</span>
                </div>
                <p className="text-sm text-slate-500">{desc}</p>
            </div>
        </label>
    );
}

function StepperItem({ stepNum, label, active, completed }: { stepNum: number, label: string, active: boolean, completed: boolean }) {
    return (
        <div className={`flex items-center gap-2 ${active ? 'text-indigo-700' : completed ? 'text-emerald-600' : 'text-slate-400'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-colors ${
                active ? 'border-indigo-600 bg-indigo-50 shrink-0 text-indigo-700' : 
                completed ? 'border-emerald-500 bg-emerald-50 shrink-0 text-emerald-600' : 
                'border-slate-300 bg-white shrink-0'
            }`}>
                {completed ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg> : stepNum}
            </div>
            <span className={active || completed ? 'font-bold' : ''}>{label}</span>
        </div>
    );
}

function StepperDivider() {
    return <div className="w-10 h-px bg-slate-200 shrink-0"></div>;
}

type ViolationCardColor = 'red' | 'orange' | 'yellow' | 'blue' | 'gray';

const VIOLATION_CARD_STYLES: Record<ViolationCardColor, { wrapper: string; badge: string; icon: string }> = {
    red:    { wrapper: 'border-red-200 bg-red-50',     badge: 'bg-red-200 text-red-800',     icon: '❌' },
    orange: { wrapper: 'border-orange-200 bg-orange-50', badge: 'bg-orange-200 text-orange-800', icon: '🚫' },
    yellow: { wrapper: 'border-yellow-200 bg-yellow-50', badge: 'bg-yellow-200 text-yellow-800', icon: '⚠️' },
    blue:   { wrapper: 'border-blue-200 bg-blue-50',   badge: 'bg-blue-200 text-blue-800',   icon: 'ℹ️' },
    gray:   { wrapper: 'border-slate-200 bg-slate-50', badge: 'bg-slate-200 text-slate-700', icon: 'ℹ️' },
};

function ViolationCard({ color, title, body, badge }: {
    color: ViolationCardColor;
    title: string;
    body?: string;
    badge?: string;
}) {
    const styles = VIOLATION_CARD_STYLES[color];
    return (
        <div className={`flex gap-3 p-3 rounded-lg border ${styles.wrapper}`}>
            <span className="text-base shrink-0 mt-0.5">{styles.icon}</span>
            <div className="text-sm min-w-0">
                <p className="font-bold text-slate-800 flex flex-wrap items-center gap-2">
                    <span>{title}</span>
                    {badge && (
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${styles.badge}`}>{badge}</span>
                    )}
                </p>
                {body && <p className="text-slate-600 mt-0.5 leading-relaxed">{body}</p>}
            </div>
        </div>
    );
}

