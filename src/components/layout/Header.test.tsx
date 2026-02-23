import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Header } from './Header';

describe('Header Component', () => {
    it('renders the search input', () => {
        render(<Header />);
        expect(screen.getByPlaceholderText(/search shifts, employees/i)).toBeInTheDocument();
    });

    it('renders the notification button', () => {
        render(<Header />);
        // The bell icon button is the only generic button, but testing by role is better.
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders the user profile information', () => {
        render(<Header />);
        expect(screen.getByText('Admin User')).toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();
    });
});
