import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WeeklyCalendar } from './WeeklyCalendar';
import type { Employee, Role, Shift } from '../../../types';

describe('WeeklyCalendar Component', () => {
    const mockDate = new Date('2026-02-23T12:00:00Z'); // Monday
    const mockEmployees: Employee[] = [
        {
            id: 'emp1',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            phone_number: '555-1234',
            total_hours_per_week: 40,
            created_at: '2026-01-01T00:00:00Z',
        },
    ];

    const mockRoles: Role[] = [
        {
            id: 'role1',
            title: 'Manager',
            color_code: '#E53935',
        },
    ];

    const mockShifts: Shift[] = [
        {
            id: 'shift1',
            employee_id: 'emp1',
            role_id: 'role1',
            location_id: 'loc1',
            start_time: '2026-02-23T09:00:00',
            end_time: '2026-02-23T17:00:00',
            break_duration_minutes: 30,
            status: 'scheduled',
            assigned_date: '2026-02-22T00:00:00',
        },
    ];

    it('renders empty state when no employees exist', () => {
        render(<WeeklyCalendar currentDate={mockDate} shifts={[]} employees={[]} roles={mockRoles} />);
        expect(screen.getByText(/No employees added yet/i)).toBeInTheDocument();
    });

    it('renders employee information', () => {
        render(<WeeklyCalendar currentDate={mockDate} shifts={[]} employees={mockEmployees} roles={mockRoles} />);
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('40h/wk')).toBeInTheDocument();
    });

    it('renders shifts correctly', () => {
        render(<WeeklyCalendar currentDate={mockDate} shifts={mockShifts} employees={mockEmployees} roles={mockRoles} />);
        // Wait for shift display
        expect(screen.getByText('09:00 - 17:00')).toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();
    });
});
