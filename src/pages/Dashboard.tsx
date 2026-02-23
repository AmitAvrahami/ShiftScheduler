import React, { useState } from 'react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { WeeklyCalendar } from '../features/shifts/components/WeeklyCalendar';
import { useShifts } from '../features/shifts/hooks/useShifts';
import { ShiftModal } from '../features/shifts/components/ShiftModal';
import { seedMockData } from '../features/shifts/services/firestoreService';
import { Calendar as CalendarIcon, Users, Loader2, Plus, Database } from 'lucide-react';

export function Dashboard() {
    const [currentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { shifts, employees, roles, loading, error, addShift } = useShifts(currentDate);

    if (error) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center shadow-sm max-w-md">
                    <div>
                        <h3 className="font-semibold text-lg">Error Loading Dashboard</h3>
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
                <p className="text-lg font-medium">Loading schedule...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50/30">
            {/* Header Area */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Weekly Schedule</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage shifts and employee schedules</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={async () => {
                            try {
                                await seedMockData();
                                window.location.reload();
                            } catch (e) {
                                alert("Failed to seed data. Make sure Firestore rules allow writes.");
                            }
                        }}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors shadow-sm"
                    >
                        Seed Mock Data
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
                    >
                        Add Shift
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
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
                            <p className="text-lg font-medium text-gray-900 mb-2">No active employees</p>
                            <p className="text-center max-w-sm">
                                You need to add employees before you can schedule shifts.
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
