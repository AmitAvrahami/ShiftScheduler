import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ManagerConstraintsPage from '../ManagerConstraintsPage';
import api, { notificationAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

vi.mock('../../lib/api', () => ({
    default: {
        get: vi.fn(),
        patch: vi.fn(),
    },
    adminAPI: {
        copyConstraintsFromPreviousWeek: vi.fn()
    },
    notificationAPI: {
        create: vi.fn()
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

        (notificationAPI.create as any).mockResolvedValue({
            data: { success: true }
        });
    });

    it('renders the page title with weekId', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            expect(screen.getByText(/הגבלות זמינות/)).toBeInTheDocument();
        });
    });

    it('Three tabs render with correct counts', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            expect(screen.getByText('עובדים שהגישו (1)')).toBeInTheDocument();
            expect(screen.getByText('בהמתנה (2)')).toBeInTheDocument();
            expect(screen.getByText('כל הגבלות')).toBeInTheDocument();
        });
    });

    it('"בהמתנה" tab is active by default and shows only pending employees', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            expect(screen.queryByText('User One')).not.toBeInTheDocument(); // Submitted
            expect(screen.getByText('User Two')).toBeInTheDocument();
            expect(screen.getByText('User Three')).toBeInTheDocument();
        });
    });

    it('Clicking "כל הגבלות" tab shows all employees', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            expect(screen.getByText('בהמתנה (2)')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('כל הגבלות'));

        await waitFor(() => {
            expect(screen.getByText('User One')).toBeInTheDocument();
            expect(screen.getByText('User Two')).toBeInTheDocument();
            expect(screen.getByText('User Three')).toBeInTheDocument();
        });
    });

    it('Clicking "צפה בפרטים" shows the mini grid panel for that employee', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        // Switch to submitted tab to see User One
        await waitFor(() => {
             fireEvent.click(screen.getByText('עובדים שהגישו (1)'));
        });

        const detailsBtn = await screen.findByRole('button', { name: /צפה בפרטים/i });
        fireEvent.click(detailsBtn);

        await waitFor(() => {
            expect(screen.getByText('תצוגת זמינות: User One')).toBeInTheDocument();
        });
    });

    it('Clicking "שלח תזכורת" calls notificationAPI.create with correct payload', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        // Wait for pending employees to load
        await waitFor(() => {
            expect(screen.getByText('User Two')).toBeInTheDocument();
        });

        // Grab all 'שלח תזכורת' buttons (there should be 2 for User Two and User Three)
        const reminderBtns = screen.getAllByRole('button', { name: /שלח תזכורת/i });
        expect(reminderBtns.length).toBe(2);

        fireEvent.click(reminderBtns[0]);

        await waitFor(() => {
            expect(notificationAPI.create).toHaveBeenCalledWith(expect.objectContaining({
                type: 'reminder',
                employeeId: 'u2'
            }));
        });
    });

    it('Previous week / next week navigation buttons work', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            expect(screen.getByText('User Two')).toBeInTheDocument();
        });

        const nextBtn = screen.getByTitle('שבוע הבא');
        const prevBtn = screen.getByTitle('שבוע קודם');

        expect(nextBtn).toBeInTheDocument();
        expect(prevBtn).toBeInTheDocument();

        vi.clearAllMocks();

        fireEvent.click(prevBtn);
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(expect.stringContaining('2026-W'));
        });

        vi.clearAllMocks();

        fireEvent.click(nextBtn);
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(expect.stringContaining('2026-W'));
        });
    });

    it('"נעל הגבלות" button is visible and enabled when not locked', async () => {
        renderWithRouter(<ManagerConstraintsPage />);

        const lockBtn = await screen.findByRole('button', { name: /נעל הגבלות/i });
        expect(lockBtn).toBeInTheDocument();
        expect(lockBtn).toBeEnabled();
    });

    it('Clicking lock button shows confirmation dialog and confirms', async () => {
        // Mock window.confirm
        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

        renderWithRouter(<ManagerConstraintsPage />);

        const lockBtn = await screen.findByRole('button', { name: /נעל הגבלות/i });

        fireEvent.click(lockBtn);

        expect(confirmSpy).toHaveBeenCalled();
        expect(api.patch).toHaveBeenCalledWith(expect.stringContaining('/constraints/lock/'));

        confirmSpy.mockRestore();
    });

    it('After lock: button changes to "נעול" and "בטל נעילה" appears', async () => {
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
                                constraints: [{ date: '2026-03-08T00:00:00.000Z', shift: 'morning', canWork: true }]
                            }
                        ]
                    }
                });
            }
            return Promise.resolve({ data: { success: true, data: [] } });
        });

        renderWithRouter(<ManagerConstraintsPage />);

        await waitFor(() => {
            const unlockBtn = screen.getByRole('button', { name: /בטל נעילה/i });
            expect(unlockBtn).toBeInTheDocument();
            const lockedBtn = screen.getByRole('button', { name: /נעול/i });
            expect(lockedBtn).toBeInTheDocument();
            expect(lockedBtn).toBeDisabled();
        });
    });
});
