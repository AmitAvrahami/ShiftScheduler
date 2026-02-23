import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Sidebar } from './Sidebar';

describe('Sidebar Component', () => {
    const renderWithRouter = (ui: React.ReactElement) => {
        return render(<MemoryRouter>{ui}</MemoryRouter>);
    };

    it('renders the application title', () => {
        renderWithRouter(<Sidebar />);
        expect(screen.getByText('ShiftAgent')).toBeInTheDocument();
    });

    it('renders all navigation links', () => {
        renderWithRouter(<Sidebar />);
        expect(screen.getByText('Schedule')).toBeInTheDocument();
        expect(screen.getByText('Shifts')).toBeInTheDocument();
        expect(screen.getByText('Team')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders the logout button', () => {
        renderWithRouter(<Sidebar />);
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });
});
