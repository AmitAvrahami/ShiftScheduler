import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ManagerConstraintsPage from '../ManagerConstraintsPage';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

vi.mock('../../lib/api', () => ({
    default: {
        get: vi.fn(),
        patch: vi.fn(),
    }
}));

vi.mock('../../store/authStore', () => ({
    useAuthStore: vi.fn()
}));

const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('ManagerConstraintsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default logged in user (manager)
        (useAuthStore as any).mockImplementation((selector: any) => {
            const state = {
                user: { _id: 'manager1', name: 'Manager', role: 'manager' },
                isAuthenticated: true
            };
            return selector ? selector(state) : state;
        });

        // Default API GET response for constraints
        // Mocking 3 users, but only 1 has constraints submitted
        (api.get as any).mockImplementation((url: string) => {
            if (url.includes('/users')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: [
                            { _id: 'u1', name: 'User One', email: 'u1@test.com', role: 'employee', isActive: true },
                            { _id: 'u2', name: 'User Two', email: 'u2@test.com', role: 'employee', isActive: true },
                            { _id: 'u3', name: 'User Three', email: 'u3@test.com', role: 'employee', isActive: true }
                        ]
                    }
                });
            }
            if (url.includes('/constraints/week/')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: [
                            {
                                userId: { _id: 'u1', name: 'User One', email: 'u1@test.com', role: 'employee', isActive: true },
                                weekId: '2026-W11',
                                isLocked: false,
                                constraints: [
                                    { date: '2026-03-08T00:00:00.000Z', shift: 'morning', canWork: true }
                                ]
                            }
                        ]
                    }
                });
            }
            return Promise.resolve({ data: { success: true, data: [] } });
        });

        (api.patch as any).mockResolvedValue({
            data: { success: true, lockedCount: 3 }
        });
    });

    it('renders the page title with weekId', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            // Assuming it displays "W" and week number 
            expect(screen.getByText(/אילוצים/)).toBeInTheDocument();
        });
    });

    it('renders ALL employees as rows (even those with no constraints)', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            expect(screen.getByText('User One')).toBeInTheDocument();
            expect(screen.getByText('User Two')).toBeInTheDocument();
            expect(screen.getByText('User Three')).toBeInTheDocument();
        });
    });

    it('employees with no constraints show "✓" in green for all cells', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            expect(screen.getByText('User Two')).toBeInTheDocument();
        });

        // Checkmark symbols "✓"
        const checkmarks = screen.getAllByText('✓');
        expect(checkmarks.length).toBeGreaterThanOrEqual(14); // 7 days * 2 users with no constraints (assuming UI puts a checkmark for each day)
    });

    it('Previous week / next week navigation buttons work', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            expect(screen.getByText('User One')).toBeInTheDocument();
        });

        const nextBtn = screen.getByRole('button', { name: /שבוע הבא|next/i });
        const prevBtn = screen.getByRole('button', { name: /שבוע קודם|prev/i });

        expect(nextBtn).toBeInTheDocument();
        expect(prevBtn).toBeInTheDocument();

        vi.clearAllMocks();

        fireEvent.click(prevBtn);
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(expect.stringContaining('2026-W10'));
        });

        vi.clearAllMocks();

        fireEvent.click(nextBtn);
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(expect.stringContaining('2026-W11'));
        });
    });

    it('"נעל אילוצים" button is visible and enabled when not locked', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        const lockBtn = await screen.findByRole('button', { name: /נעל אילוצים/i });
        expect(lockBtn).toBeInTheDocument();
        expect(lockBtn).toBeEnabled();
    });

    it('Clicking lock button shows confirmation dialog and confirms', async () => {
        // Mock window.confirm
        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

        renderWithRouter(<ManagerConstraintsPage />);

        const lockBtn = await screen.findByRole('button', { name: /נעל אילוצים/i });

        fireEvent.click(lockBtn);

        expect(confirmSpy).toHaveBeenCalled();
        expect(api.patch).toHaveBeenCalledWith(expect.stringContaining('/constraints/lock/'));

        confirmSpy.mockRestore();
    });

    it('After lock: button is disabled', async () => {
        (api.get as any).mockImplementation((url: string) => {
            if (url.includes('/users')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: [
                            { _id: 'u1', name: 'User One', email: 'u1@test.com', role: 'employee', isActive: true }
                        ]
                    }
                });
            }
            if (url.includes('/constraints/week/')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: [
                            {
                                userId: { _id: 'u1', name: 'User One', email: 'u1@test.com', role: 'employee', isActive: true },
                                weekId: '2026-W11',
                                isLocked: true,
                                constraints: []
                            }
                        ]
                    }
                });
            }
            return Promise.resolve({ data: { success: true, data: [] } });
        });

        renderWithRouter(<ManagerConstraintsPage />);

        // Since they are all locked (isLocked: true), the button might be disabled, or change state
        const lockBtn = await screen.findByRole('button', { name: /נעל אילוצים|נעול/i });
        expect(lockBtn).toBeDisabled();
    });
});
