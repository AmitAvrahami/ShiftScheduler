import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useShifts } from './useShifts';
import * as firestoreService from '../services/firestoreService';
import { addDoc } from 'firebase/firestore';

// Mock dependencies
vi.mock('../services/firestoreService', () => ({
    subscribeToEmployees: vi.fn(),
    subscribeToRoles: vi.fn(),
    subscribeToShifts: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: vi.fn(),
}));

vi.mock('../../../lib/firebase/config', () => ({
    db: {},
}));

describe('useShifts Hook', () => {
    const mockDate = new Date('2026-02-23T12:00:00Z');

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mock implementations for subscriptions
        (firestoreService.subscribeToEmployees as any).mockImplementation((cb: Function) => {
            cb([{ id: 'emp1', first_name: 'John' }]);
            return vi.fn(); // unsubscribe
        });

        (firestoreService.subscribeToRoles as any).mockImplementation((cb: Function) => {
            cb([{ id: 'role1', title: 'Manager' }]);
            return vi.fn(); // unsubscribe
        });

        (firestoreService.subscribeToShifts as any).mockImplementation((start: Date, end: Date, cb: Function) => {
            cb([{ id: 'shift1', employee_id: 'emp1' }]);
            return vi.fn(); // unsubscribe
        });
    });

    it('should initialize with loading state and then load data', async () => {
        const { result } = renderHook(() => useShifts(mockDate));

        // Wait for state updates triggered by the effect callbacks
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.shifts).toHaveLength(1);
        expect(result.current.employees).toHaveLength(1);
        expect(result.current.roles).toHaveLength(1);
    });

    it('should handle adding a shift', async () => {
        const mockNewShiftId = 'new-shift-123';
        (addDoc as any).mockResolvedValueOnce({ id: mockNewShiftId });

        const { result } = renderHook(() => useShifts(mockDate));

        const shiftData = {
            employee_id: 'emp1',
            role_id: 'role1',
            location_id: 'loc1',
            start_time: '2026-02-23T09:00:00Z',
            end_time: '2026-02-23T17:00:00Z',
            break_duration_minutes: 30,
            status: 'scheduled' as const,
            assigned_date: '2026-02-23T00:00:00Z',
        };

        const id = await result.current.addShift(shiftData);

        expect(id).toBe(mockNewShiftId);
        expect(addDoc).toHaveBeenCalled();
    });
});
