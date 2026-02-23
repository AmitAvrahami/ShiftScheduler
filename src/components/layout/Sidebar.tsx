import React from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, Users, Settings, LogOut, Briefcase } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const navItems = [
    { icon: CalendarDays, label: 'Schedule', path: '/' },
    { icon: Briefcase, label: 'Shifts', path: '/shifts' },
    { icon: Users, label: 'Team', path: '/team' },
    { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
    return (
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="h-16 flex items-center px-6 border-b border-gray-200">
                <h1 className="text-xl font-euclid text-primary font-bold">ShiftAgent</h1>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.label}
                        to={item.path}
                        className={({ isActive }) => cn(
                            'flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                            isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                    >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-200">
                <button className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                </button>
            </div>
        </aside>
    );
}
