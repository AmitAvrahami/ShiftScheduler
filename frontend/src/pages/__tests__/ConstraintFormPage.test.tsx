import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ConstraintFormPage from '../ConstraintFormPage';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore'; // We will assume standard store path, adjust if wrong

// Mock the API module
vi.mock('../../lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    }
}));

// Mock the auth store (assuming it is zustand and exports useAuthStore)
vi.mock('../../store/authStore', () => ({
    useAuthStore: vi.fn()
}));

const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('ConstraintFormPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default logged in user (employee)
        (useAuthStore as any).mockImplementation((selector: any) => {
            const state = {
                user: { _id: 'emp1', name: 'Employee', role: 'employee' },
                isAuthenticated: true
            };
            return selector ? selector(state) : state;
        });

        // Default API GET response for constraints
        (api.get as any).mockResolvedValue({
            data: {
                success: true,
                data: null // No existing constraints initially
            }
        });

        // Default API POST response
        (api.post as any).mockResolvedValue({
            data: { success: true }
        });
    });

    it('renders 7 days in Hebrew with correct shifts', async () => {
        renderWithRouter(<ConstraintFormPage />);

        // Wait for initial render/fetch
        await waitFor(() => {
            expect(screen.getByText('ראשון')).toBeInTheDocument();
        });

        // Verify all days
        const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        days.forEach(day => {
            expect(screen.getByText(day)).toBeInTheDocument();
        });

        // Verify shifts (בוקר, צהריים, לילה)
        const morningShifts = screen.getAllByText('בוקר');
        const afternoonShifts = screen.getAllByText('צהריים');
        const nightShifts = screen.getAllByText('לילה');

        // Each day has 3 shifts
        expect(morningShifts.length).toBeGreaterThanOrEqual(7);
        expect(afternoonShifts.length).toBeGreaterThanOrEqual(7);
        expect(nightShifts.length).toBeGreaterThanOrEqual(7);

        // Explicitly check that 'אחריים' is NOT used (only checking if text 'אחריים' exists)
        const badShifts = screen.queryAllByText('אחריים');
        expect(badShifts.length).toBe(0);
    });

    it('toggles shift checkboxes on and off', async () => {
        renderWithRouter(<ConstraintFormPage />);

        await waitFor(() => {
            expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
        });

        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        const firstCheckbox = checkboxes[0];

        // Initially unchecked (since we mocked null constraints)
        expect(firstCheckbox.checked).toBe(false);

        // Click to check
        fireEvent.click(firstCheckbox);
        expect(firstCheckbox.checked).toBe(true);

        // Click to uncheck
        fireEvent.click(firstCheckbox);
        expect(firstCheckbox.checked).toBe(false);
    });

    it('enables submit button when form is dirty', async () => {
        renderWithRouter(<ConstraintFormPage />);

        // Assuming submit button has type submit or role button containing text "שמור חסימות" or "שלח"
        const submitBtn = await screen.findByRole('button', { name: /שמור|שלח/i });

        // Initially mostly enabled/disabled depending on implementation, but if form tracking dirty state:
        // We will check if we can click the checkbox and it remains enabled.
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);
        expect(submitBtn).toBeEnabled();
    });

    // Depending on how Toast is implemented, it might render DOM nodes. Assuming sonner or react-hot-toast.
    // Actually, we can just verify if API is called since Toast checking might be flaky without full app context.
    it('calls API and shows success toast (implicitly via API mock check)', async () => {
        renderWithRouter(<ConstraintFormPage />);

        await waitFor(() => {
            expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
        });

        // Toggle a constraint
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);

        // Submit
        const submitBtn = screen.getByRole('button', { name: /שמור|שלח/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/constraints'), expect.any(Object));
        });
    });

    it('shows lock message and forces read-only when isLocked=true', async () => {
        // Mock API to return locked constraints
        (api.get as any).mockResolvedValue({
            data: {
                success: true,
                data: {
                    isLocked: true,
                    constraints: []
                }
            }
        });

        renderWithRouter(<ConstraintFormPage />);

        await waitFor(() => {
            expect(screen.getByText(/האילוצים ננעלו ולא ניתן לשנות/)).toBeInTheDocument();
        });

        // Form elements should be disabled
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        expect(checkboxes[0]).toBeDisabled();

        // Submit button should be hidden or disabled
        // If it exists, it should be disabled
        const saveButtons = screen.queryAllByRole('button', { name: /שמור|שלח/i });
        if (saveButtons.length > 0) {
            expect(saveButtons[0]).toBeDisabled();
        }
    });
});
