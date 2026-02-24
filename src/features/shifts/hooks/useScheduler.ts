import { useState, useCallback, useRef } from 'react';
import type { Employee as DbEmployee, Shift as DbShift } from '../../../types';
import type { Employee as AlgoEmployee, Shift as AlgoShift, ScheduleEvaluation, ShiftType } from '../algorithm/types';

interface UseSchedulerResult {
    generateSchedule: (employees: DbEmployee[], shifts: DbShift[]) => Promise<ScheduleEvaluation>;
    isGenerating: boolean;
}

export function useScheduler(): UseSchedulerResult {
    const [isGenerating, setIsGenerating] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    // Map Database Employee to Algorithm Employee
    const mapEmployeeToAlgo = (emp: DbEmployee): AlgoEmployee => {
        return {
            id: emp.id,
            name: `${emp.first_name} ${emp.last_name}`,
            maxDailyHours: 12, // Default hardcoded for now, could be added to preferences
            maxConsecutiveDays: 6, // Default
            // Map simple constraints if needed, or leave preferred array empty for now
            preferredShiftTypes: [],
            avoidShiftTypes: [],
            preferredDates: [],
            avoidDates: [],
            vacationDates: [],
            unavailableTimeBlocks: []
        };
    };

    // Map Database Shift to Algorithm Shift
    const mapShiftToAlgo = (shift: DbShift): AlgoShift => {
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);

        // Determine type based on hours roughly
        const hour = start.getHours();
        let type: ShiftType = 'custom';
        if (hour >= 6 && hour < 14) type = 'morning';
        else if (hour >= 14 && hour < 22) type = 'evening';
        else if (hour >= 22 || hour < 6) type = 'night';

        // Extract pure date string YYYY-MM-DD
        const dateStr = start.toISOString().split('T')[0];

        return {
            id: shift.id,
            date: dateStr,
            startTime: start,
            endTime: end,
            type,
            minRequiredEmployees: 1, // Defaulting to 1 for this shift record
            maxAllowedEmployees: 1
        };
    };

    const generateSchedule = useCallback((dbEmployees: DbEmployee[], dbShifts: DbShift[]): Promise<ScheduleEvaluation> => {
        return new Promise((resolve, reject) => {
            if (isGenerating) {
                return reject(new Error('Already generating a schedule.'));
            }

            setIsGenerating(true);

            // Initialize worker if not already
            if (!workerRef.current) {
                // We use standard Vite worker import syntax
                workerRef.current = new Worker(new URL('../algorithm/worker.ts', import.meta.url), {
                    type: 'module'
                });
            }

            const algoEmployees = dbEmployees.map(mapEmployeeToAlgo);
            const algoShifts = dbShifts.map(mapShiftToAlgo);

            workerRef.current.onmessage = (e: MessageEvent<ScheduleEvaluation>) => {
                setIsGenerating(false);
                resolve(e.data);
            };

            workerRef.current.onerror = (error) => {
                setIsGenerating(false);
                reject(error);
            };

            workerRef.current.postMessage({
                employees: algoEmployees,
                shifts: algoShifts,
                options: {
                    maxIterations: 10000
                }
            });
        });
    }, [isGenerating]);

    return {
        generateSchedule,
        isGenerating
    };
}
