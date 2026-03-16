import { useState, useId, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

type TooltipLevel = 'info' | 'warning' | 'critical';

interface ConstraintTooltipProps {
    level: TooltipLevel;
    reason: string;
    action: string;
}

const LEVEL_CONFIG: Record<TooltipLevel, {
    iconColor: string;
    dotClass: string;
    labelColor: string;
    borderClass: string;
    label: string;
}> = {
    info: {
        iconColor: '#3B82F6',
        dotClass: 'bg-blue-500',
        labelColor: 'text-blue-600',
        borderClass: 'border-blue-300',
        label: 'מידע',
    },
    warning: {
        iconColor: '#F59E0B',
        dotClass: 'bg-amber-500',
        labelColor: 'text-amber-600',
        borderClass: 'border-amber-300',
        label: 'אזהרה',
    },
    critical: {
        iconColor: '#EF4444',
        dotClass: 'bg-red-500',
        labelColor: 'text-red-600',
        borderClass: 'border-red-300',
        label: 'שגיאה',
    },
};

const TOOLTIP_WIDTH = 224; // w-56 = 14rem = 224px
const TOOLTIP_HEIGHT_ESTIMATE = 100;
const GAP = 8;

export function ConstraintTooltip({ level, reason, action }: ConstraintTooltipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
    const uid = useId();
    const tooltipId = `constraint-tooltip-${uid}`;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const config = LEVEL_CONFIG[level];

    const isTouchDevice = () => window.matchMedia('(hover: none)').matches;

    const calculatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceAbove = rect.top;
        const top = spaceAbove >= TOOLTIP_HEIGHT_ESTIMATE + GAP
            ? rect.top - TOOLTIP_HEIGHT_ESTIMATE - GAP
            : rect.bottom + GAP;
        // RTL: right-align tooltip to trigger's right edge, clamped to viewport
        const left = Math.max(0, Math.min(rect.right - TOOLTIP_WIDTH, window.innerWidth - TOOLTIP_WIDTH - 8));
        setTooltipPos({ top, left });
    };

    const handleMouseEnter = () => {
        if (isTouchDevice()) return;
        hoverTimerRef.current = setTimeout(() => {
            calculatePosition();
            setIsOpen(true);
        }, 300);
    };

    const handleMouseLeave = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setIsOpen(false);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (!isTouchDevice()) return;
        e.stopPropagation();
        if (!isOpen) {
            calculatePosition();
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isOpen) {
                calculatePosition();
                setIsOpen(true);
            } else {
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    // Recalculate position when tooltip opens (catches layout shifts)
    useLayoutEffect(() => {
        if (isOpen) calculatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const close = () => setIsOpen(false);
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [isOpen]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
    }, []);

    return (
        <div className="inline-flex" dir="rtl">
            <button
                ref={triggerRef}
                type="button"
                aria-label={`${config.label}: ${reason}`}
                aria-describedby={isOpen ? tooltipId : undefined}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                // Prevent DnD (dnd-kit) from treating this as a drag start
                onPointerDown={e => e.stopPropagation()}
                className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-sm"
                style={{ color: config.iconColor }}
            >
                {/* Exclamation-triangle SVG — sized to fit inline with small text */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3 h-3"
                    aria-hidden="true"
                >
                    <path
                        fillRule="evenodd"
                        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                    />
                </svg>
            </button>

            {isOpen && tooltipPos && createPortal(
                <div
                    id={tooltipId}
                    role="tooltip"
                    // Stop propagation so outside-click handler doesn't close immediately on open
                    onPointerDown={e => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        top: tooltipPos.top,
                        left: tooltipPos.left,
                        zIndex: 9999,
                        width: TOOLTIP_WIDTH,
                    }}
                    className={`bg-white border rounded-lg shadow-md p-3 text-right ${config.borderClass}`}
                    dir="rtl"
                >
                    {/* Severity row */}
                    <div className="flex items-center justify-end gap-1.5 mb-1.5">
                        <span className={`text-xs font-semibold ${config.labelColor}`}>
                            {config.label}
                        </span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dotClass}`} />
                    </div>

                    {/* Reason */}
                    <p className="text-xs text-gray-700 leading-snug">{reason}</p>

                    {/* Suggested action */}
                    <p className="text-xs text-gray-400 italic mt-1.5 leading-snug">
                        {action}
                    </p>
                </div>,
                document.body
            )}
        </div>
    );
}
