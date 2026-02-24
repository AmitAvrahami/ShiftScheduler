import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ShiftModal } from './ShiftModal';
import type { Employee, Role } from '../../../types';

describe('ShiftModal Component', () => {
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

    it('does not render when isOpen is false', () => {
        render(<ShiftModal isOpen={false} onClose={vi.fn()} employees={mockEmployees} roles={mockRoles} onAddShift={vi.fn()} />);
        expect(screen.queryByText('Add New Shift')).not.toBeInTheDocument();
    });

    it('renders correctly when isOpen is true', () => {
        render(<ShiftModal isOpen={true} onClose={vi.fn()} employees={mockEmployees} roles={mockRoles} onAddShift={vi.fn()} />);
        expect(screen.getByText('Add New Shift')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();
    });

    it('shows validation errors when submitting an empty form', async () => {
        const user = userEvent.setup();
        render(<ShiftModal isOpen={true} onClose={vi.fn()} employees={mockEmployees} roles={mockRoles} onAddShift={vi.fn()} />);

        const submitButton = screen.getByRole('button', { name: /save shift/i });
        await user.click(submitButton);

        expect(await screen.findByText('Employee is required')).toBeInTheDocument();
        expect(await screen.findByText('Role is required')).toBeInTheDocument();
    });

    it('calls onAddShift with correct data on successful submission', async () => {
        const user = userEvent.setup();
        const mockOnAddShift = vi.fn().mockResolvedValue('new-id');
        const mockOnClose = vi.fn();

        render(
            <ShiftModal
                isOpen={true}
                onClose={mockOnClose}
                employees={mockEmployees}
                roles={mockRoles}
                onAddShift={mockOnAddShift}
            />
        );

        // Select employee
        const employeeSelect = screen.getByLabelText(/employee/i);
        await user.selectOptions(employeeSelect, 'emp1');

        // Select role
        const roleSelect = screen.getByLabelText(/role/i);
        await user.selectOptions(roleSelect, 'role1');

        // Input date
        const dateInput = screen.getByLabelText(/date/i);
        fireEvent.change(dateInput, { target: { value: '2026-02-23' } });

        // Submit form
        const submitButton = screen.getByRole('button', { name: /save shift/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnAddShift).toHaveBeenCalledWith(expect.objectContaining({
                employee_id: 'emp1',
                role_id: 'role1',
                status: 'scheduled',
            }));

            // Validate time explicitly by checking it includes the correct time portions
            const shiftArg = mockOnAddShift.mock.calls[0][0];
            expect(shiftArg.start_time).toContain('09:00:00');
            expect(shiftArg.end_time).toContain('17:00:00');
            expect(mockOnClose).toHaveBeenCalled();
        });
    });
});
