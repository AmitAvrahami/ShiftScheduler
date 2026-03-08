import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationAPI } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppNotification {
    _id: string;
    message: string;
    weekId: string;
    type: string;
    isRead: boolean;
    createdAt: string;
}

const POLL_INTERVAL_MS = 60_000; // 60 seconds

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Notification bell icon with unread badge and dropdown list.
 *
 * Polls the notifications endpoint every 60 seconds.
 * Clicking the bell toggles the dropdown; clicking "סמן כנקרא" marks
 * the notification as read and removes it from the unread count.
 *
 * Pattern: Observer-like polling — periodically syncs state from server.
 */
export default function NotificationBell() {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await notificationAPI.getAll();
            setNotifications(res.data.data.notifications || []);
            setUnreadCount(res.data.data.unreadCount || 0);
        } catch {
            // Silently fail — bell is non-critical UI
        }
    }, []);

    // Initial load + 60-second polling
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /**
     * Marks a notification as read via the API and removes it from local state.
     */
    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await notificationAPI.markAsRead(notificationId);
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // Silently fail
        }
    };

    return (
        <div className="relative" ref={dropdownRef} dir="rtl">
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="התראות"
                title="התראות"
            >
                {/* Bell Icon */}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800 text-sm">התראות</h3>
                        {unreadCount > 0 && (
                            <span className="text-xs text-gray-400">{unreadCount} לא נקראו</span>
                        )}
                    </div>

                    <div className="max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-sm text-gray-400">
                                אין התראות חדשות
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification._id}
                                    className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                >
                                    <p className="text-sm text-gray-700 leading-relaxed">{notification.message}</p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs text-gray-400">
                                            {new Date(notification.createdAt).toLocaleDateString('he-IL')}
                                        </span>
                                        <button
                                            onClick={() => handleMarkAsRead(notification._id)}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                        >
                                            סמן כנקרא
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
