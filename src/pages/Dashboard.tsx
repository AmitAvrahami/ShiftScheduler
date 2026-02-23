import React, { useState, useEffect } from 'react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { WeeklyCalendar } from '../components/calendar/WeeklyCalendar';
import type { Employee, Role, Shift } from '../types';
import { subscribeToEmployees, subscribeToRoles, subscribeToShifts } from '../services/api';

export function Dashboard() {
    const [currentDate] = useState(new Date());
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let unsubscribeShifts = () => { };
        let unsubscribeEmployees = () => { };
        let unsubscribeRoles = () => { };

        const loadData = () => {
            try {
                setLoading(true);

                unsubscribeEmployees = subscribeToEmployees((newEmployees) => {
                    setEmployees(newEmployees);
                });

                unsubscribeRoles = subscribeToRoles((newRoles) => {
                    setRoles(newRoles);
                });

                // Setup realtime listener for shifts in the current week
                const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

                unsubscribeShifts = subscribeToShifts(weekStart, weekEnd, (newShifts) => {
                    setShifts(newShifts);
                    // Once shifts are loaded, we can disable the full screen spinner
                    setLoading(false);
                });

            } catch (err) {
                console.error("Failed to load dashboard data", err);
                setError("Failed to connect to the database. Check console for details.");
                setLoading(false);
            }
        };

        loadData();

        return () => {
            unsubscribeShifts();
            unsubscribeEmployees();
            unsubscribeRoles();
        };
    }, [currentDate]);

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-euclid font-bold text-gray-900">Weekly Schedule</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage shifts and employee schedules</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={async () => {
                            setLoading(true);
                            const { seedMockData } = await import('../services/api');
                            try {
                                await seedMockData();
                                window.location.reload();
                            } catch (e) {
                                alert("Failed to seed data. Make sure Firestore rules allow writes.");
                                setLoading(false);
                            }
                        }}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors shadow-sm"
                    >
                        Seed Mock Data
                    </button>
                    <button className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm">
                        Add Shift
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4 text-sm font-medium">
                        {error}
                    </div>
                )}

                <WeeklyCalendar
                    currentDate={currentDate}
                    shifts={shifts}
                    employees={employees}
                    roles={roles}
                />
            </div>
        </div>
    );
}
