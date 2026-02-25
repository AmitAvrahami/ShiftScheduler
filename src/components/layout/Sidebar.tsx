import { NavLink } from 'react-router-dom';
import { CalendarDays, Users, Settings, LogOut, Briefcase } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * Tailwind class merger utility.
 * @param inputs - Class values to merge
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Application sidebar with navigation links.
 * Labels are translated via the active language strategy.
 * The icon margin flips automatically via CSS logical properties
 * (me-3 = margin-inline-end) so it works for both LTR and RTL.
 */
export function Sidebar() {
    const { t } = useLanguage();

    /** Navigation items defined with translation keys */
    const navItems = [
        { icon: CalendarDays, labelKey: 'nav.schedule', path: '/', id: 'nav-schedule' },
        { icon: Briefcase, labelKey: 'nav.shifts', path: '/shifts', id: 'nav-shifts' },
        { icon: Users, labelKey: 'nav.team', path: '/team', id: 'nav-team' },
        { icon: Settings, labelKey: 'nav.settings', path: '/settings', id: 'nav-settings' },
    ];

    return (
        <aside className="w-64 bg-white border-e border-gray-200 flex flex-col flex-shrink-0 relative z-20">
            {/* Brand */}
            <div className="h-16 flex items-center px-6 border-b border-gray-200">
                <h1 className="text-xl font-euclid text-primary font-bold">{t('app.name')}</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        id={item.id}
                        end={item.path === '/'}
                        className={({ isActive }) => cn(
                            'flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                            isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                    >
                        {/* me-3 = margin-inline-end → auto-flips in RTL */}
                        <item.icon className="w-5 h-5 me-3 flex-shrink-0" />
                        {t(item.labelKey)}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-gray-200">
                <button
                    id="sidebar-logout"
                    className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <LogOut className="w-4 h-4 me-2" />
                    {t('nav.logout')}
                </button>
            </div>
        </aside>
    );
}
