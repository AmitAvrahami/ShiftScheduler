import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeeModal } from './EmployeeModal';
import type { Role } from '../../../types';

describe('EmployeeModal', () => {
    const mockRoles: Role[] = [
        { id: 'role-1', title: 'Manager', permissions: [] },
        { id: 'role-2', title: 'Cashier', permissions: [] },
    ];

    it('renders correctly when open', () => {
        render(
            <EmployeeModal
                isOpen={true}
                onClose={() => { }}
                onSave={() => { }}
                roles={mockRoles}
            />
        );
        expect(screen.getByText('Add New Employee')).toBeInTheDocument();
        expect(screen.getByText('Personal Info')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(
            <EmployeeModal
                isOpen={false}
                onClose={() => { }}
                onSave={() => { }}
                roles={mockRoles}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('validates required fields on submit', async () => {
        const handleSave = vi.fn();
        const user = userEvent.setup();

        render(
            <EmployeeModal
                isOpen={true}
                onClose={() => { }}
                onSave={handleSave}
                roles={mockRoles}
            />
        );

        // Submit form without filling anything
        const saveButton = screen.getByText('Save Employee');
        await user.click(saveButton);

        // Check for validation errors
        expect(await screen.findByText('First name is required')).toBeInTheDocument();
        expect(screen.getByText('Last name is required')).toBeInTheDocument();
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
        expect(screen.getByText('Phone number is required')).toBeInTheDocument();
        expect(screen.getByText('At least one role is required')).toBeInTheDocument();

        expect(handleSave).not.toHaveBeenCalled();
    });

    it('validates shift preferences logic (min <= max)', async () => {
        const handleSave = vi.fn();
        const user = userEvent.setup();

        render(
            <EmployeeModal
                isOpen={true}
                onClose={() => { }}
                onSave={handleSave}
                roles={mockRoles}
            />
        );

        // Fill min > max to trigger validation error
        const minShiftsInput = screen.getByLabelText(/Min Shifts/i);
        const maxShiftsInput = screen.getByLabelText(/Max Shifts/i);

        await user.clear(minShiftsInput);
        await user.type(minShiftsInput, '5');

        await user.clear(maxShiftsInput);
        await user.type(maxShiftsInput, '2');

        const saveButton = screen.getByText('Save Employee');
        await user.click(saveButton);

        // Expect validation error for max_shifts_per_week
        expect(await screen.findByText('Min shifts cannot be greater than max shifts')).toBeInTheDocument();
    });

    it('validates constraints (start time < end time)', async () => {
        const handleSave = vi.fn();
        const user = userEvent.setup();

        render(
            <EmployeeModal
                isOpen={true}
                onClose={() => { }}
                onSave={handleSave}
                roles={mockRoles}
            />
        );

        // Add a constraint
        const addConstraintButton = screen.getByText(/Add Constraint/i);
        await user.click(addConstraintButton);

        // Change start time to be after end time
        const startInputs = await screen.findAllByLabelText(/Start Time/i);
        const endInputs = await screen.findAllByLabelText(/End Time/i);

        const startInput = startInputs[0];
        const endInput = endInputs[0];

        // time inputs need text in format HH:MM
        await user.type(startInput, '14:00');
        await user.type(endInput, '10:00');

        const saveButton = screen.getByText('Save Employee');
        await user.click(saveButton);

        // Setup looks for constraint errors
        expect(await screen.findByText('End time must be after start time')).toBeInTheDocument();
        expect(handleSave).not.toHaveBeenCalled();
    });

    it('populates form when editing an existing employee', () => {
        const mockEmployee: any = {
            id: 'emp-1',
            first_name: 'Jane',
            last_name: 'Smith',
            email: 'jane@example.com',
            phone_number: '555-9876',
            role_ids: ['role-2'],
            preferences: {
                target_shifts_per_week: 4,
                min_shifts_per_week: 2,
                max_shifts_per_week: 5,
                constraints: []
            }
        };

        render(
            <EmployeeModal
                isOpen={true}
                onClose={() => { }}
                onSave={() => { }}
                roles={mockRoles}
                employee={mockEmployee}
            />
        );

        expect(screen.getByText('Edit Employee')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Smith')).toBeInTheDocument();
        expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('555-9876')).toBeInTheDocument();
        expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    });

    it('submits successfully with valid data and handles constraint removal', async () => {
        const handleSave = vi.fn();
        const user = userEvent.setup();

        render(
            <EmployeeModal
                isOpen={true}
                onClose={() => { }}
                onSave={handleSave}
                roles={mockRoles}
            />
        );

        // Fill out valid personal info
        await user.type(screen.getByLabelText(/First Name/i), 'New');
        await user.type(screen.getByLabelText(/Last Name/i), 'Employee');
        await user.type(screen.getByLabelText(/Email/i), 'new@example.com');
        await user.type(screen.getByLabelText(/Phone Number/i), '1234567890');

        // Select a role
        const roleSelect = screen.getByLabelText(/Assigned Roles/i);
        await user.selectOptions(roleSelect, ['role-1']);

        // Add two constraints
        const addConstraintButton = screen.getByText(/Add Constraint/i);
        await user.click(addConstraintButton);
        await user.click(addConstraintButton);

        // Actually, there's a close button for the modal and remove buttons for constraints.
        // the remove constraint buttons have the trash icon.
        // Let's just find the trash icons parent button.
        const buttons = screen.getAllByRole('button');
        for (const btn of buttons) {
            if (btn.querySelector('svg.lucide-trash-2')) {
                await user.click(btn);
                break;
            }
        }

        const saveButton = screen.getByText('Save Employee');
        await user.click(saveButton);

        await waitFor(() => {
            expect(handleSave).toHaveBeenCalledTimes(1);
        });

        // Verify the payload
        const payload = handleSave.mock.calls[0][0];
        expect(payload.first_name).toBe('New');
        expect(payload.role_ids).toContain('role-1');

        // 2 constraints added, 1 removed, should be 1 remaining
        expect(payload.preferences.constraints).toHaveLength(1);
        // And generated IDs for constraints should be present
        expect(payload.preferences.constraints[0].id).toBeDefined();
    });

    it('validates constraints correctly when no times are provided', async () => {
        const handleSave = vi.fn();
        const user = userEvent.setup();

        render(
            <EmployeeModal
                isOpen={true}
                onClose={() => { }}
                onSave={handleSave}
                roles={mockRoles}
            />
        );

        // Fill required fields
        await user.type(screen.getByLabelText(/First Name/i), 'Test');
        await user.type(screen.getByLabelText(/Last Name/i), 'User');
        await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
        await user.type(screen.getByLabelText(/Phone Number/i), '123');
        await user.selectOptions(screen.getByLabelText(/Assigned Roles/i), ['role-1']);

        // Add a constraint but leave times empty
        await user.click(screen.getByText(/Add Constraint/i));

        const saveButton = screen.getByText('Save Employee');
        await user.click(saveButton);

        await waitFor(() => {
            expect(handleSave).toHaveBeenCalledTimes(1);
        });

        // Check if constraint valid (it should returning true since start/end times not both provided)
        expect(handleSave.mock.calls[0][0].preferences.constraints).toHaveLength(1);
    });
});
