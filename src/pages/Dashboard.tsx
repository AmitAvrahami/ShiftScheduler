import { useState } from 'react';
import { WeeklyCalendar } from '../features/shifts/components/WeeklyCalendar';
import { useShifts } from '../features/shifts/hooks/useShifts';
import { ShiftModal } from '../features/shifts/components/ShiftModal';
import { seedMockData } from '../features/shifts/services/firestoreService';
import { useScheduler } from '../features/shifts/hooks/useScheduler';
import { useLanguage } from '../i18n/LanguageContext';
import toast from 'react-hot-toast';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';

/**
 * Dashboard page — shows the weekly schedule calendar.
 * All visible strings are resolved through the `t()` function
 * so they update automatically when the language changes.
 */
export function Dashboard() {
    const [currentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { shifts, employees, roles, loading, error, addShift, updateShift } = useShifts(currentDate);
    const { generateSchedule, isGenerating } = useScheduler();
    const { t } = useLanguage();

    /**
     * Runs the scheduling algorithm and applies new assignments.
     *
     * @throws Will display a toast on failure without re-throwing.
     */
    const handleGenerateDraft = async () => {
        try {
            const evaluation = await generateSchedule(employees, shifts);
            const hardViolationsCount = evaluation.constraintViolations.filter(
                (v: any) => v.type === 'hard'
            ).length;

            toast.success(
                t('dashboard.scheduleGenerated', {
                    hardViolations: hardViolationsCount,
                    penaltyScore: Math.round(evaluation.penaltyScore),
                }),
                { duration: 5000 }
            );

            // Apply assignments to Firestore
            const promises: Promise<void>[] = [];
            evaluation.schedule.forEach((assignedEmpIds: string[], shiftId: string) => {
                const shift = shifts.find((s) => s.id === shiftId);
                if (shift && assignedEmpIds.length > 0 && shift.employee_id !== assignedEmpIds[0]) {
                    promises.push(updateShift(shiftId, { employee_id: assignedEmpIds[0], status: 'scheduled' }));
                }
            });

            if (promises.length > 0) {
                await Promise.all(promises);
                toast.success(t('dashboard.appliedAssignments', { count: promises.length }));
            } else {
                toast(t('dashboard.noNewAssignments'), { icon: 'ℹ️' });
            }
        } catch (err) {
            console.error('Failed to generate draft:', err);
            toast.error(t('dashboard.generateFailed'));
        }
    };

    if (error) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center shadow-sm max-w-md">
                    <div>
                        <h3 className="font-semibold text-lg">{t('dashboard.errorTitle')}</h3>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                <p className="text-lg font-medium">{t('dashboard.loadingSchedule')}</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50/30">
            {/* Header Area */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
                    <p className="text-sm text-gray-500 mt-1">{t('dashboard.subtitle')}</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {/* Seed Mock Data */}
                    <button
                        id="dashboard-seed-data"
                        onClick={async () => {
                            try {
                                await seedMockData();
                                window.location.reload();
                            } catch {
                                alert(t('dashboard.seedDataError'));
                            }
                        }}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors shadow-sm"
                    >
                        {t('dashboard.seedMockData')}
                    </button>

                    {/* Generate Draft */}
                    <button
                        id="dashboard-generate-draft"
                        onClick={handleGenerateDraft}
                        disabled={isGenerating || shifts.length === 0 || employees.length === 0}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-75 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 me-2 animate-spin" />
                                {t('dashboard.generating')}
                            </>
                        ) : (
                            t('dashboard.generateDraft')
                        )}
                    </button>

                    {/* Add Shift */}
                    <button
                        id="dashboard-add-shift"
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
                    >
                        {t('dashboard.addShift')}
                    </button>
                </div>
            </div>

            {/* Calendar Area */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto p-4 sm:p-6 p-safe">
                    {employees.length > 0 ? (
                        <WeeklyCalendar
                            currentDate={currentDate}
                            shifts={shifts}
                            employees={employees}
                            roles={roles}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <CalendarIcon className="w-16 h-16 mb-4 text-gray-300" />
                            <p className="text-lg font-medium text-gray-900 mb-2">
                                {t('dashboard.noActiveEmployees')}
                            </p>
                            <p className="text-center max-w-sm">
                                {t('dashboard.noActiveEmployeesDescription')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ShiftModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                employees={employees}
                roles={roles}
                onAddShift={addShift}
            />
        </div>
    );
}
