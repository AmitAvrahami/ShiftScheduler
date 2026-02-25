import { Search, Bell, User } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSelector } from '../../i18n/LanguageSelector';

/**
 * Top application header bar.
 * Renders the search field, notification bell, user info, and language selector.
 * Automatically mirrors layout for RTL languages via CSS logical properties.
 */
export function Header() {
    const { t, isRTL } = useLanguage();

    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10 w-full">
            {/* Search — placed on the start side */}
            <div className="flex-1">
                <div className="relative w-96">
                    <span
                        className="absolute inset-y-0 flex items-center pl-3"
                        style={{ [isRTL ? 'right' : 'left']: 0, [isRTL ? 'left' : 'right']: 'auto', paddingLeft: isRTL ? 0 : undefined, paddingRight: isRTL ? '0.75rem' : undefined }}
                    >
                        <Search className="w-5 h-5 text-gray-400" />
                    </span>
                    <input
                        type="text"
                        placeholder={t('header.searchPlaceholder')}
                        className="w-full py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                        style={{ paddingInlineStart: '2.5rem', paddingInlineEnd: '1rem' }}
                        id="header-search"
                    />
                </div>
            </div>

            {/* Right-side actions */}
            <div className="flex items-center gap-4">
                {/* Language Selector */}
                <LanguageSelector />

                {/* Notification Bell */}
                <button
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors relative"
                    id="header-notifications"
                    aria-label="Notifications"
                >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                </button>

                {/* User Info */}
                <div className="flex items-center gap-3 border-s border-gray-200 ps-4 ms-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        <User className="w-4 h-4" />
                    </div>
                    <div className="text-sm">
                        <p className="font-medium text-gray-900 leading-none">{t('header.adminUser')}</p>
                        <p className="text-gray-500 text-xs mt-1">{t('header.manager')}</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
