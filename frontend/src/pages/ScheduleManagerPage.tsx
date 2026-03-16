import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    useDroppable,
    useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { scheduleAPI, usersAPI, constraintAPI, SaveShiftsPayload } from '../lib/api';
import { ConstraintTooltip } from '../components/ui/ConstraintTooltip';
import { getCurrentWeekId, getWeekDates, getWeekId, getWeekNumber, formatWeekDateRange } from '../utils/weekUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeBasic {
    _id: string;
    name: string;
}

type ShiftType = 'morning' | 'afternoon' | 'night';

interface EditorShift {
    date: string;        // ISO date string (YYYY-MM-DD or full ISO)
    type: ShiftType;
    employees: EmployeeBasic[];
}

interface ScheduleData {
    _id: string;
    weekStartDate: string;
    shifts: EditorShift[];
    isPublished: boolean;
}

/**
 * Maps "date|type" → array of constraint records.
 * canWork=false means the employee has declared they cannot work that shift.
 */
interface ConstraintEntry {
    userId: string;
    canWork: boolean;
}
type ConstraintMap = Record<string, ConstraintEntry[]>;

/** Identifies where a drag originated */
interface DragSource {
    kind: 'sidebar' | 'cell';
    employee: EmployeeBasic;
    /** For kind=cell only */
    cellKey?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_LABELS: Record<ShiftType, string> = {
    morning: 'בוקר',
    afternoon: 'צהריים',
    night: 'לילה',
};

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const SHIFT_TYPES: ShiftType[] = ['morning', 'afternoon', 'night'];
const MAX_UNDO_HISTORY = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the ISO date key (YYYY-MM-DD) for a Date object, in local time.
 * Used to match shift.date values coming from the backend.
 */
function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Derives the canonicalized date key from a shift's date field.
 * Uses LOCAL time (same as toDateKey) so that dates stored as UTC midnight
 * or local midnight are both correctly mapped to the local calendar day.
 * e.g. "2026-03-13T22:00:00.000Z" (Saturday midnight IST) → "2026-03-14"
 */
function shiftDateKey(dateValue: string): string {
    const d = new Date(dateValue);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Determines the required headcount for a given day+shift combination,
 * mirroring the backend scheduling rules.
 */
function getRequiredCount(date: Date, shiftType: ShiftType): number {
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 5 && dayOfWeek !== 6) {
        return shiftType === 'night' ? 1 : 2;
    } else if (dayOfWeek === 5) {
        return shiftType === 'morning' ? 2 : 1;
    }
    return 1; // Saturday
}

/**
 * Converts the raw shifts from ScheduleData (which may have ObjectId employees)
 * into the EditorShift format the editor works with.
 */
function normaliseShifts(rawShifts: ScheduleData['shifts']): EditorShift[] {
    return rawShifts.map(shift => ({
        date: shiftDateKey(shift.date as unknown as string),
        type: shift.type,
        employees: (shift.employees as unknown as (EmployeeBasic | string)[]).map(emp =>
            typeof emp === 'string'
                ? { _id: emp, name: '—' }
                : (emp as EmployeeBasic)
        ),
    }));
}

/**
 * Deep-clones an EditorShift array (pure function, safe for history stack).
 */
function cloneShifts(shifts: EditorShift[]): EditorShift[] {
    return shifts.map(s => ({ ...s, employees: [...s.employees] }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Draggable employee pill/chip shown inside shift cells.
 *
 * @param id       - Unique draggable ID (format: `cell-{date}-{type}-{empId}`)
 * @param employee - Employee data
 * @param hasConstraint - Whether this employee has a constraint violation for this cell
 * @param isPublished   - When true, disables removal controls
 * @param onRemove      - Callback to remove this employee from the shift
 */
function EmployeeCard({
    id,
    employee,
    hasConstraint,
    isPublished,
    onRemove,
    isDragOverlay = false,
}: {
    id: string;
    employee: EmployeeBasic;
    hasConstraint: boolean;
    isPublished: boolean;
    onRemove?: () => void;
    isDragOverlay?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

    const style = isDragOverlay
        ? { transform: CSS.Transform.toString(transform) }
        : { transform: CSS.Transform.toString(transform) };

    return (
        <div
            ref={isDragOverlay || isPublished ? undefined : setNodeRef}
            style={style}
            className={`
                flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
                select-none transition-all
                ${!isPublished ? 'cursor-grab active:cursor-grabbing' : ''}
                ${hasConstraint
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200 hover:bg-indigo-200'
                }
                ${isDragging && !isDragOverlay ? 'opacity-40 scale-95' : 'opacity-100'}
            `}
            {...(isDragOverlay || isPublished ? {} : { ...attributes, ...listeners })}
        >
            {/* Drag handle */}
            {!isPublished && (
                <span className="text-gray-400 text-[10px] leading-none mr-0.5 pointer-events-none">
                    ⠿
                </span>
            )}

            {/* Constraint warning icon */}
            {hasConstraint && (
                <ConstraintTooltip
                    level="critical"
                    reason={`${employee.name} הצהיר/ה שאינו/ה יכול/ה לעבוד במשמרת זו`}
                    action="העבר למשמרת אחרת או אשר עקיפת האילוץ"
                />
            )}

            <span>{employee.name}</span>

            {/* Remove button */}
            {!isPublished && onRemove && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="mr-0.5 text-gray-400 hover:text-red-600 font-bold leading-none focus:outline-none"
                    title="הסר עובד"
                    aria-label={`הסר את ${employee.name}`}
                    // Prevent drag events from firing on the X button
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    ✕
                </button>
            )}
        </div>
    );
}

/**
 * Sidebar card for employees not yet assigned to a cell.
 * Can be dragged from the sidebar into any shift cell.
 */
function SidebarEmployeeCard({
    employee,
    constraintCellKeys,
    weekDates,
}: {
    employee: EmployeeBasic;
    /** Set of "date|type" keys where this employee has canWork=false */
    constraintCellKeys: Set<string>;
    weekDates: Date[];
}) {
    const id = `sidebar-${employee._id}`;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

    const hasAnyConstraint = weekDates.some(date =>
        SHIFT_TYPES.some(type =>
            constraintCellKeys.has(`${toDateKey(date)}|${type}`)
        )
    );

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform) }}
            className={`
                flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium
                border cursor-grab active:cursor-grabbing select-none transition-all
                ${hasAnyConstraint
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-white border-gray-200 text-gray-800 hover:bg-indigo-50 hover:border-indigo-300'
                }
                ${isDragging ? 'opacity-40 scale-95' : 'shadow-sm hover:shadow'}
            `}
            {...attributes}
            {...listeners}
        >
            <span className="text-gray-400 text-xs pointer-events-none">⠿</span>
            <span className="text-gray-500">👤</span>
            <span className="flex-1">{employee.name}</span>
            {hasAnyConstraint && (
                <ConstraintTooltip
                    level="warning"
                    reason={`${employee.name} הצהיר/ה שאינו/ה יכול/ה לעבוד בחלק ממשמרות השבוע`}
                    action="בדוק אילו משמרות חסומות לפני שיבוץ"
                />
            )}
        </div>
    );
}

/**
 * Droppable shift cell that holds employee cards.
 * Highlights blue on valid drag-over, red on invalid (duplicate/same cell).
 */
function ShiftCell({
    cellKey,
    employees,
    date,
    shiftType,
    constraints,
    overId,
    activeSource,
    isPublished,
    onRemoveEmployee,
}: {
    cellKey: string;
    employees: EmployeeBasic[];
    date: Date;
    shiftType: ShiftType;
    constraints: ConstraintMap;
    overId: string | null;
    activeSource: DragSource | null;
    isPublished: boolean;
    onRemoveEmployee: (employeeId: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: cellKey });

    const isBeingDraggedOver = overId === cellKey;
    const draggedEmployeeId = activeSource?.employee._id;

    // Determine if this would be an invalid drop (duplicate)
    const isInvalidDrop = isBeingDraggedOver &&
        draggedEmployeeId !== undefined &&
        employees.some(e => e._id === draggedEmployeeId);

    const dateKey = toDateKey(date);
    const required = getRequiredCount(date, shiftType);
    const count = employees.length;

    /** Coverage badge colour */
    const coverageBadgeClass = count < required
        ? 'bg-red-100 text-red-700'
        : count > required
            ? 'bg-orange-100 text-orange-700'
            : 'bg-green-100 text-green-700';

    return (
        <td
            ref={setNodeRef}
            className={`
                py-2 px-2 align-top min-w-[90px] transition-colors border-r border-gray-100 last:border-r-0
                ${isInvalidDrop ? 'bg-red-50 ring-2 ring-red-400 ring-inset' : ''}
                ${isBeingDraggedOver && !isInvalidDrop ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''}
                ${!isBeingDraggedOver && isOver ? 'bg-blue-50' : ''}
            `}
        >
            {/* Coverage indicator */}
            <div className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5 mb-1 ${coverageBadgeClass}`}>
                {count < required && (
                    <ConstraintTooltip
                        level="critical"
                        reason={`חסר/ים ${required - count} עובד/ים — לא עומד בדרישת המינימום`}
                        action="גרור עובדים נוספים מהעמודה הצדדית"
                    />
                )}
                {count}/{required}
            </div>

            {/* Employee cards */}
            <div className="flex flex-wrap gap-1 min-h-[28px]">
                {employees.length === 0 && !isBeingDraggedOver && (
                    <span className="text-xs text-gray-300 self-center">—</span>
                )}
                {employees.map(emp => {
                    const constraintKey = `${dateKey}|${shiftType}`;
                    const cellConstraints = constraints[constraintKey] ?? [];
                    const empConstraint = cellConstraints.find(c => c.userId === emp._id);
                    const hasConstraint = empConstraint?.canWork === false;

                    return (
                        <EmployeeCard
                            key={emp._id}
                            id={`cell-${dateKey}-${shiftType}-${emp._id}`}
                            employee={emp}
                            hasConstraint={hasConstraint}
                            isPublished={isPublished}
                            onRemove={isPublished ? undefined : () => onRemoveEmployee(emp._id)}
                        />
                    );
                })}
            </div>
        </td>
    );
}

/**
 * Droppable trash zone at the bottom of the schedule table.
 * Dragging any card here removes the employee from their shift.
 */
function TrashZone({ overId }: { overId: string | null }) {
    const { setNodeRef } = useDroppable({ id: 'trash' });
    const isActive = overId === 'trash';

    return (
        <div
            ref={setNodeRef}
            className={`
                mt-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed
                py-3 text-sm font-medium transition-all
                ${isActive
                    ? 'border-red-400 bg-red-50 text-red-600 scale-105 shadow-md'
                    : 'border-gray-300 text-gray-400 hover:border-gray-400'
                }
            `}
        >
            <span className="text-xl">🗑️</span>
            <span>גרור לכאן להסרה</span>
        </div>
    );
}

/**
 * Styled confirmation modal for constraint violations.
 * Shown when a manager drops an employee onto a shift they declared unavailability for.
 */
function ConstraintWarningModal({
    employeeName,
    onConfirm,
    onCancel,
}: {
    employeeName: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" dir="rtl">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <h2 className="text-lg font-bold text-gray-800">אילוץ משמרת</h2>
                </div>
                <p className="text-gray-600 text-sm">
                    ל<strong>{employeeName}</strong> יש אילוץ למשמרת זו — הם הצהירו שלא יכולים לעבוד.
                    האם להוסיף אותם בכל זאת?
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                    >
                        ביטול
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-white bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors"
                    >
                        כן, הוסף בכל זאת
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Manager-only page for generating and editing the weekly schedule.
 *
 * Features:
 * - Week selector (prev/next)
 * - Drag-and-drop shift editor using @dnd-kit/core
 * - Employee sidebar (all active employees)
 * - Trash zone for removal
 * - Constraint warning modal
 * - Undo history (max 10 states)
 * - "שמור שינויים" — saves draft via PATCH /api/schedules/:weekId/shifts
 * - "פרסם סידור" — publishes the schedule (existing flow, blocked if dirty)
 *
 * State management uses Strategy Pattern for drag handling:
 * - DragStart records origin (sidebar vs cell)
 * - DragEnd dispatches appropriate mutation based on source+target combination
 */
export default function ScheduleManagerPage() {
    // ── Week state ─────────────────────────────────────────────────────────────
    const [weekId, setWeekId] = useState<string>(getCurrentWeekId());
    const [weekDates, setWeekDates] = useState<Date[]>([]);

    // ── Schedule state ─────────────────────────────────────────────────────────
    const [schedule, setSchedule] = useState<ScheduleData | null>(null);
    const [editorShifts, setEditorShifts] = useState<EditorShift[]>([]);
    const [originalShifts, setOriginalShifts] = useState<EditorShift[]>([]);

    // ── Supporting data ────────────────────────────────────────────────────────
    const [allEmployees, setAllEmployees] = useState<EmployeeBasic[]>([]);
    const [constraints, setConstraints] = useState<ConstraintMap>({});

    // ── UI state ───────────────────────────────────────────────────────────────
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isEditingPublished, setIsEditingPublished] = useState(false);
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);

    // ── DnD state ──────────────────────────────────────────────────────────────
    const [activeSource, setActiveSource] = useState<DragSource | null>(null);
    const [overId, setOverId] = useState<string | null>(null);

    // ── Undo history ───────────────────────────────────────────────────────────
    const [history, setHistory] = useState<EditorShift[][]>([]);

    // ── Constraint warning modal ───────────────────────────────────────────────
    const [pendingDrop, setPendingDrop] = useState<{
        employee: EmployeeBasic;
        targetCellKey: string;
        sourceCellKey: string | undefined;
    } | null>(null);

    // Dirty flag — true when editor differs from the last saved/generated state
    const isDirty = JSON.stringify(editorShifts) !== JSON.stringify(originalShifts);

    // ── Sensors (pointer + keyboard for a11y) ──────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor),
    );

    // ── Compute week dates ─────────────────────────────────────────────────────
    useEffect(() => {
        try {
            setWeekDates(getWeekDates(weekId));
        } catch {
            // invalid weekId — ignore
        }
    }, [weekId]);

    /** Fetches schedule, employees list, and constraints in parallel. */
    const loadWeekData = useCallback(async () => {
        setIsLoadingSchedule(true);
        setHistory([]);
        setSchedule(null);
        setEditorShifts([]);
        setOriginalShifts([]);
        setIsEditingPublished(false);

        try {
            const [scheduleRes, usersRes, constraintsRes] = await Promise.allSettled([
                scheduleAPI.getSchedule(weekId),
                usersAPI.getAll(),
                constraintAPI.getWeekConstraints(weekId),
            ]);

            // ── Employees ────────────────────────────────────────────────────
            if (usersRes.status === 'fulfilled') {
                setAllEmployees(usersRes.value.data.data ?? []);
            }

            // ── Constraints ──────────────────────────────────────────────────
            if (constraintsRes.status === 'fulfilled') {
                const rawConstraints: {
                    userId: { _id: string } | string;
                    constraints: { date: string; shift: string; canWork: boolean }[];
                }[] = constraintsRes.value.data.data ?? [];

                const constraintMap: ConstraintMap = {};
                rawConstraints.forEach(entry => {
                    if (!entry.userId) return; // Skip if userId is null or undefined (e.g. deleted user)

                    const userId = typeof entry.userId === 'object'
                        ? entry.userId._id
                        : entry.userId;

                    entry.constraints.forEach(c => {
                        const dateKey = shiftDateKey(c.date);
                        const mapKey = `${dateKey}|${c.shift}`;
                        if (!constraintMap[mapKey]) constraintMap[mapKey] = [];
                        constraintMap[mapKey].push({ userId, canWork: c.canWork });
                    });
                });
                setConstraints(constraintMap);
            }

            // ── Schedule ─────────────────────────────────────────────────────
            // 200 → load into editor (works for both draft and published schedules)
            // non-200 (e.g. 404) → scheduleRes.status === 'rejected' → show empty state
            if (scheduleRes.status === 'fulfilled') {
                const loadedSchedule: ScheduleData = scheduleRes.value.data.data;
                setSchedule(loadedSchedule);
                const normalised = normaliseShifts(loadedSchedule.shifts);
                setEditorShifts(normalised);
                setOriginalShifts(cloneShifts(normalised));
            } else {
                // 404 or any error → show empty state
                setSchedule(null);
                setEditorShifts([]);
                setOriginalShifts([]);
            }
        } finally {
            setIsLoadingSchedule(false);
        }
    }, [weekId]);

    // ── Load data for selected week ────────────────────────────────────────────
    // Runs on mount and every time weekId changes.
    // loadWeekData is memoised with weekId as its dep, so adding it here is safe
    // and satisfies the exhaustive-deps rule without triggering infinite loops.
    useEffect(() => {
        loadWeekData();
    }, [weekId, loadWeekData]);

    // ── Toast helper ──────────────────────────────────────────────────────────
    const showToast = useCallback((text: string, type: 'success' | 'error') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Week navigation ───────────────────────────────────────────────────────
    const handlePrevWeek = () => {
        if (weekDates.length > 0) {
            const prevSunday = new Date(weekDates[0].getTime() - 7 * 24 * 60 * 60 * 1000);
            setWeekId(getWeekId(prevSunday));
        }
    };

    const handleNextWeek = () => {
        if (weekDates.length > 0) {
            const nextSunday = new Date(weekDates[0].getTime() + 7 * 24 * 60 * 60 * 1000);
            setWeekId(getWeekId(nextSunday));
        }
    };

    // ── Generate schedule ─────────────────────────────────────────────────────

    /** Runs the actual generation API call, regardless of whether a schedule already exists. */
    const doGenerate = async () => {
        setIsGenerating(true);
        setWarnings([]);
        try {
            const res = await scheduleAPI.generate(weekId);
            const generatedSchedule: ScheduleData = res.data.data.schedule;
            setSchedule(generatedSchedule);
            const normalised = normaliseShifts(generatedSchedule.shifts);
            setEditorShifts(normalised);
            setOriginalShifts(cloneShifts(normalised));
            setHistory([]);
            setWarnings(res.data.data.warnings ?? []);
            showToast('הסידור נוצר בהצלחה!', 'success');
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'שגיאה ביצירת הסידור';
            showToast(message, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    /** Guards generation: shows confirm dialog if a draft schedule already exists. */
    const handleGenerate = async () => {
        if (hasSchedule && !isPublished) {
            setShowRegenerateConfirm(true);
            return;
        }
        await doGenerate();
    };

    // ── Save draft shifts ─────────────────────────────────────────────────────
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload: SaveShiftsPayload = {
                shifts: editorShifts.map(s => ({
                    date: s.date,
                    type: s.type,
                    employees: s.employees.map(e => e._id),
                })),
            };
            await scheduleAPI.saveShifts(weekId, payload);
            setOriginalShifts(cloneShifts(editorShifts));
            setHistory([]);
            showToast('השינויים נשמרו בהצלחה ✓', 'success');
            if (isEditingPublished) setIsEditingPublished(false);
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'שגיאה בשמירת השינויים';
            showToast(message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Publish schedule ──────────────────────────────────────────────────────
    const handlePublish = async () => {
        setShowConfirm(false);
        setIsPublishing(true);
        try {
            const res = await scheduleAPI.publish(weekId);
            setSchedule(res.data.data);
            showToast('הסידור פורסם בהצלחה לכל העובדים!', 'success');
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'שגיאה בפרסום הסידור';
            showToast(message, 'error');
        } finally {
            setIsPublishing(false);
        }
    };

    // ── Delete schedule ───────────────────────────────────────────────────────
    const handleDelete = async () => {
        setShowDeleteConfirm(false);
        setIsDeleting(true);
        try {
            await scheduleAPI.deleteSchedule(weekId);
            setSchedule(null);
            setEditorShifts([]);
            setOriginalShifts([]);
            setHistory([]);
            setWarnings([]);
            showToast('הסידור נמחק בהצלחה. העובדים קיבלו התראה.', 'success');
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'שגיאה במחיקת הסידור';
            showToast(message, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    // ── Undo ──────────────────────────────────────────────────────────────────
    const handleUndo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setEditorShifts(previous);
        setHistory(prev => prev.slice(0, -1));
    };

    /**
     * Pushes the current editorShifts onto the undo history stack
     * before mutating state. Caps the stack at MAX_UNDO_HISTORY.
     */
    const pushHistory = (currentShifts: EditorShift[]) => {
        setHistory(prev => {
            const next = [...prev, cloneShifts(currentShifts)];
            return next.length > MAX_UNDO_HISTORY ? next.slice(-MAX_UNDO_HISTORY) : next;
        });
    };

    // ── Build a cell key from date+type ───────────────────────────────────────
    const makeCellKey = (dateKey: string, shiftType: ShiftType) =>
        `cell-${dateKey}-${shiftType}`;

    // ── Apply a shift mutation (pure function approach) ───────────────────────

    /**
     * Core mutation: removes an employee from a source cell and/or adds
     * them to a target cell. Pure in intent — does not trigger side-effects.
     *
     * @param shifts      - Current editor shifts (will be cloned before mutation)
     * @param sourceCellKey   - "cell-date-type" key of the origin cell, if dragged from a cell
     * @param targetCellKey   - "cell-date-type" key of the destination cell
     * @param employee        - The employee being moved
     */
    const applyEmployeeMove = useCallback((
        shifts: EditorShift[],
        sourceCellKey: string | undefined,
        targetCellKey: string,
        employee: EmployeeBasic,
    ): EditorShift[] => {
        const next = cloneShifts(shifts);

        // Parse the target cell key to find the matching shift
        // key format: "cell-YYYY-MM-DD-shiftType"
        const parseCellKey = (key: string): { dateKey: string; shiftType: ShiftType } => {
            // cell-2026-03-08-morning → split from right: last segment = type
            const parts = key.replace(/^cell-/, '').split('-');
            const shiftType = parts[parts.length - 1] as ShiftType;
            const dateKey = parts.slice(0, -1).join('-');
            return { dateKey, shiftType };
        };

        // Remove from source cell
        if (sourceCellKey) {
            const { dateKey, shiftType } = parseCellKey(sourceCellKey);
            const sourceShift = next.find(
                s => s.date === dateKey && s.type === shiftType
            );
            if (sourceShift) {
                sourceShift.employees = sourceShift.employees.filter(e => e._id !== employee._id);
            }
        }

        // Add to target cell (create shift entry if it doesn't exist)
        const { dateKey: targetDate, shiftType: targetType } = parseCellKey(targetCellKey);
        let targetShift = next.find(s => s.date === targetDate && s.type === targetType);
        if (!targetShift) {
            targetShift = { date: targetDate, type: targetType, employees: [] };
            next.push(targetShift);
        }

        // Prevent duplicate
        if (!targetShift.employees.find(e => e._id === employee._id)) {
            targetShift.employees.push(employee);
        }

        return next;
    }, []);

    /**
     * Removes an employee from a specific cell.
     */
    const applyEmployeeRemoval = useCallback((
        shifts: EditorShift[],
        cellKey: string,
        employeeId: string,
    ): EditorShift[] => {
        const next = cloneShifts(shifts);
        const parts = cellKey.replace(/^cell-/, '').split('-');
        const shiftType = parts[parts.length - 1] as ShiftType;
        const dateKey = parts.slice(0, -1).join('-');

        const shift = next.find(s => s.date === dateKey && s.type === shiftType);
        if (shift) {
            shift.employees = shift.employees.filter(e => e._id !== employeeId);
        }
        return next;
    }, []);

    // ── Remove employee via ✕ button ─────────────────────────────────────────
    const handleRemoveEmployee = useCallback((cellKey: string, employeeId: string) => {
        pushHistory(editorShifts);
        setEditorShifts(prev => applyEmployeeRemoval(prev, cellKey, employeeId));
    }, [editorShifts, applyEmployeeRemoval]);

    // ── DnD event handlers ────────────────────────────────────────────────────

    /**
     * `onDragStart`: Records the drag source (sidebar or cell) and the employee being dragged.
     * Uses the draggable ID format to determine origin:
     *   - `sidebar-{empId}` → from sidebar
     *   - `cell-{date}-{type}-{empId}` → from a shift cell
     */
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const activeId = String(event.active.id);

        if (activeId.startsWith('sidebar-')) {
            const empId = activeId.replace('sidebar-', '');
            const emp = allEmployees.find(e => e._id === empId);
            if (emp) {
                setActiveSource({ kind: 'sidebar', employee: emp });
            }
        } else if (activeId.startsWith('cell-')) {
            // Format: cell-{YYYY-MM-DD}-{type}-{empId}
            // The empId is everything after the last dash-group that forms the type
            const withoutPrefix = activeId.replace(/^cell-/, '');
            const parts = withoutPrefix.split('-');
            // Last segment is empId (ObjectId hex)
            const empId = parts[parts.length - 1];
            // Second-to-last is the shift type; everything before is the date
            const shiftTypePart = parts[parts.length - 2] as ShiftType;
            const dateParts = parts.slice(0, -2);
            const dateKey = dateParts.join('-');
            const cellKey = makeCellKey(dateKey, shiftTypePart);

            // Find the employee in editorShifts
            const shift = editorShifts.find(
                s => s.date === dateKey && s.type === shiftTypePart
            );
            const emp = shift?.employees.find(e => e._id === empId)
                ?? allEmployees.find(e => e._id === empId);

            if (emp) {
                setActiveSource({ kind: 'cell', employee: emp, cellKey });
            }
        }
    }, [allEmployees, editorShifts]);

    /** `onDragOver`: Tracks which droppable the pointer is currently over. */
    const handleDragOver = useCallback((event: DragOverEvent) => {
        setOverId(event.over ? String(event.over.id) : null);
    }, []);

    /**
     * `onDragEnd`: The core dispatch handler.
     * Strategy:
     *   - Dropped on trash → remove from source cell
     *   - Dropped on a cell → move (with constraint check)
     *   - Dropped elsewhere → snap back (no-op)
     */
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setOverId(null);

        const source = activeSource;
        setActiveSource(null);

        if (!source || !event.over) return;

        const targetId = String(event.over.id);

        // ── Drop on trash ──────────────────────────────────────────────────
        if (targetId === 'trash') {
            if (source.kind === 'cell' && source.cellKey) {
                pushHistory(editorShifts);
                setEditorShifts(prev =>
                    applyEmployeeRemoval(prev, source.cellKey!, source.employee._id)
                );
            }
            // Sidebar → trash is a no-op
            return;
        }

        // ── Drop on a shift cell ───────────────────────────────────────────
        if (targetId.startsWith('cell-')) {
            // Prevent dropping on the same cell (if dragged from a cell)
            if (source.kind === 'cell' && source.cellKey === targetId) return;

            // Prevent duplicate employee in target cell
            const parsedTarget = (() => {
                const parts = targetId.replace(/^cell-/, '').split('-');
                const shiftType = parts[parts.length - 1] as ShiftType;
                const dateKey = parts.slice(0, -1).join('-');
                return { dateKey, shiftType };
            })();
            const targetShift = editorShifts.find(
                s => s.date === parsedTarget.dateKey && s.type === parsedTarget.shiftType
            );
            if (targetShift?.employees.find(e => e._id === source.employee._id)) {
                // Employee already in target — reject silently
                return;
            }

            // Check for constraint violation (canWork=false)
            const constraintKey = `${parsedTarget.dateKey}|${parsedTarget.shiftType}`;
            const cellConstraints = constraints[constraintKey] ?? [];
            const empConstraint = cellConstraints.find(c => c.userId === source.employee._id);
            const hasViolation = empConstraint?.canWork === false;

            if (hasViolation) {
                // Show the styled confirmation modal; defer the actual mutation
                setPendingDrop({
                    employee: source.employee,
                    targetCellKey: targetId,
                    sourceCellKey: source.kind === 'cell' ? source.cellKey : undefined,
                });
                return;
            }

            // No violation — apply move immediately
            pushHistory(editorShifts);
            setEditorShifts(prev =>
                applyEmployeeMove(
                    prev,
                    source.kind === 'cell' ? source.cellKey : undefined,
                    targetId,
                    source.employee,
                )
            );
        }
    }, [activeSource, editorShifts, constraints, applyEmployeeMove, applyEmployeeRemoval]);

    /** Confirmed constraint override → apply the pending drop. */
    const handleConstraintConfirm = () => {
        if (!pendingDrop) return;
        pushHistory(editorShifts);
        setEditorShifts(prev =>
            applyEmployeeMove(
                prev,
                pendingDrop.sourceCellKey,
                pendingDrop.targetCellKey,
                pendingDrop.employee,
            )
        );
        setPendingDrop(null);
    };

    // ── Derived display state ─────────────────────────────────────────────────
    const isPublished = schedule?.isPublished ?? false;
    const hasSchedule = !!schedule;
    // true when schedule is published AND the manager has not clicked "Edit Arrangement"
    const isReadOnly = isPublished && !isEditingPublished;

    // Can delete if schedule exists AND the week is current or in the future
    const weekEndDate = weekDates.length > 0 ? weekDates[weekDates.length - 1] : null;
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const isCurrentOrFutureWeek = weekEndDate ? weekEndDate >= todayMidnight : false;
    const canDelete = hasSchedule && isCurrentOrFutureWeek;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50" dir="rtl">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <nav className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-screen-xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">ניהול סידור עבודה</h1>
                    <Link
                        to="/dashboard"
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                        → חזרה ללוח הבקרה
                    </Link>
                </div>
            </nav>

            <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
                {/* ── Action Bar ─────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
                    {/* Week selector */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleNextWeek}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                            title="שבוע הבא"
                            aria-label="שבוע הבא"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <span className="inline-flex flex-col items-center px-3 min-w-[150px]">
                            <span className="font-semibold text-gray-700 text-sm">שבוע {getWeekNumber(weekId)}</span>
                            <span className="text-xs text-gray-400">{formatWeekDateRange(weekId)}</span>
                        </span>
                        <button
                            onClick={handlePrevWeek}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                            title="שבוע קודם"
                            aria-label="שבוע קודם"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Undo */}
                        {!isReadOnly && (
                            <button
                                onClick={handleUndo}
                                disabled={history.length === 0}
                                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title="בטל פעולה אחרונה"
                            >
                                ↩ בטל
                            </button>
                        )}

                        {/* Generate */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || isPublished || isLoadingSchedule}
                            title={isPublished ? 'הסידור כבר פורסם לשבוע זה' : undefined}
                            className="px-4 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isGenerating ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin">⟳</span> יוצר...
                                </span>
                            ) : 'צור סידור'}
                        </button>

                        {/* Edit Arrangement — shown only when published and not yet in edit mode */}
                        {isPublished && !isEditingPublished && (
                            <button
                                onClick={() => setIsEditingPublished(true)}
                                disabled={isLoadingSchedule}
                                className="px-4 py-2 text-sm bg-amber-500 text-white font-medium rounded-lg shadow-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                ✎ ערוך סידור
                            </button>
                        )}

                        {/* Save — shown when not read-only (draft or editing-published mode) */}
                        {!isReadOnly && (
                            <button
                                onClick={handleSave}
                                disabled={!isDirty || isSaving || !hasSchedule}
                                className={`px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all
                                    ${isDirty && hasSchedule
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                {isSaving ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin">⟳</span> שומר...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5">
                                        💾 שמור שינויים
                                        {isDirty && <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse inline-block" />}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Publish — shows "✓ הסידור פורסם" (green, disabled) when already published */}
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={!hasSchedule || isPublished || isPublishing || isDirty || isLoadingSchedule}
                            className={`px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-colors
                                ${isPublished
                                    ? 'bg-green-600 text-white cursor-default opacity-90'
                                    : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                                }
                            `}
                            title={isDirty && !isPublished ? 'יש שינויים שלא נשמרו — שמור תחילה' : undefined}
                        >
                            {isPublishing ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-spin">⟳</span> מפרסם...
                                </span>
                            ) : isPublished ? (
                                '✓ הסידור פורסם'
                            ) : 'פרסם סידור'}
                        </button>

                        {/* Delete — shown only when a current/future schedule exists */}
                        {canDelete && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isDeleting || isLoadingSchedule}
                                className="px-4 py-2 text-sm bg-red-600 text-white font-medium rounded-lg shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="מחק את הסידור לשבוע זה"
                            >
                                {isDeleting ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin">⟳</span> מוחק...
                                    </span>
                                ) : '🗑 מחק סידור'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Warning banner: saving a published schedule will notify all employees */}
                {isPublished && isEditingPublished && isDirty && (
                    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <span>⚠️</span>
                        <span>שמירה תשלח התראה לכל העובדים</span>
                    </div>
                )}

                {/* Unsaved changes banner */}
                {isDirty && !isPublished && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-blue-700 text-sm">
                        <span>●</span>
                        <span>יש שינויים שלא נשמרו. לחץ "שמור שינויים" לשמירה, או "פרסם" לא יהיה זמין.</span>
                    </div>
                )}

                {/* Published badge */}
                {isPublished && (
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium">הסידור פורסם לעובדים — שינויים ישלחו התראה לעובדים</span>
                    </div>
                )}

                {/* Generation warnings */}
                {warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1">
                        <p className="font-semibold text-amber-800 mb-2">⚠ אזהרות:</p>
                        {warnings.map((w, i) => (
                            <p key={i} className="text-sm text-amber-700">{w}</p>
                        ))}
                    </div>
                )}

                {/* ── Main content ───────────────────────────────────────────── */}
                {isLoadingSchedule ? (
                    <ScheduleLoadingSkeleton />
                ) : !hasSchedule ? (
                    <EmptyScheduleState />
                ) : (
                    <DndContext
                        sensors={sensors}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex gap-4">
                            {/* ── Schedule Table (75%) ─────────────────────── */}
                            <div className="flex-1 min-w-0">
                                <div className="overflow-x-auto bg-white rounded-xl shadow border border-gray-200">
                                    <table className="w-full text-sm text-center">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="py-3 px-4 font-semibold text-gray-600 text-right w-20 min-w-[80px]">
                                                    משמרת
                                                </th>
                                                {weekDates.map((date, idx) => (
                                                    <th
                                                        key={idx}
                                                        className="py-3 px-2 font-semibold text-gray-600 min-w-[90px]"
                                                    >
                                                        <div>{DAY_NAMES[idx]}</div>
                                                        <div className="text-xs text-gray-400 font-normal">
                                                            {date.getDate()}/{date.getMonth() + 1}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {SHIFT_TYPES.map(shiftType => (
                                                <tr
                                                    key={shiftType}
                                                    className="border-b border-gray-100 last:border-0"
                                                >
                                                    <td className="py-3 px-4 text-right font-semibold text-gray-700 align-top border-r border-gray-100">
                                                        {SHIFT_LABELS[shiftType]}
                                                    </td>
                                                    {weekDates.map((date, dayIdx) => {
                                                        const dateKey = toDateKey(date);
                                                        const cellKey = makeCellKey(dateKey, shiftType);
                                                        const shift = editorShifts.find(
                                                            s => s.date === dateKey && s.type === shiftType
                                                        );
                                                        return (
                                                            <ShiftCell
                                                                key={dayIdx}
                                                                cellKey={cellKey}
                                                                employees={shift?.employees ?? []}
                                                                date={date}
                                                                shiftType={shiftType}
                                                                constraints={constraints}
                                                                overId={overId}
                                                                activeSource={activeSource}
                                                                isPublished={isReadOnly}
                                                                onRemoveEmployee={(empId) =>
                                                                    handleRemoveEmployee(cellKey, empId)
                                                                }
                                                            />
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Trash zone */}
                                {!isReadOnly && <TrashZone overId={overId} />}
                            </div>

                            {/* ── Employee Sidebar (25%) ───────────────────── */}
                            {!isReadOnly && (
                                <div className="w-52 flex-shrink-0">
                                    <div className="bg-white rounded-xl border border-gray-200 shadow sticky top-4">
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <h2 className="font-semibold text-gray-700 text-sm">
                                                👥 עובדים זמינים
                                            </h2>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                גרור לתוך משמרת להוספה
                                            </p>
                                        </div>
                                        <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                                            {allEmployees.map(emp => {
                                                // Build set of constraint cell keys for this employee
                                                const empConstraintKeys = new Set<string>();
                                                Object.entries(constraints).forEach(([key, entries]) => {
                                                    const entry = entries.find(c => c.userId === emp._id);
                                                    if (entry?.canWork === false) {
                                                        empConstraintKeys.add(key);
                                                    }
                                                });

                                                return (
                                                    <SidebarEmployeeCard
                                                        key={emp._id}
                                                        employee={emp}
                                                        constraintCellKeys={empConstraintKeys}
                                                        weekDates={weekDates}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Drag Overlay (ghost card while dragging) ─── */}
                        <DragOverlay>
                            {activeSource ? (
                                <div className="bg-white border-2 border-indigo-400 rounded-full px-3 py-1.5 text-sm font-medium text-indigo-800 shadow-xl opacity-90 flex items-center gap-2">
                                    <span>👤</span>
                                    <span>{activeSource.employee.name}</span>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </main>

            {/* ── Constraint violation modal ─────────────────────────────────── */}
            {pendingDrop && (
                <ConstraintWarningModal
                    employeeName={pendingDrop.employee.name}
                    onConfirm={handleConstraintConfirm}
                    onCancel={() => setPendingDrop(null)}
                />
            )}

            {/* ── Regenerate confirmation dialog ─────────────────────────────── */}
            {showRegenerateConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" dir="rtl">
                        <h2 className="text-lg font-bold text-gray-800">יצירת סידור מחדש</h2>
                        <p className="text-gray-600 text-sm">
                            קיים סידור לשבוע זה. ליצור מחדש?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowRegenerateConfirm(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={async () => {
                                    setShowRegenerateConfirm(false);
                                    await doGenerate();
                                }}
                                className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
                            >
                                כן, צור מחדש
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete confirmation dialog ─────────────────────────────────── */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" dir="rtl">
                        <h2 className="text-lg font-bold text-red-700">מחיקת סידור עבודה</h2>
                        <p className="text-gray-600 text-sm">
                            האם למחוק את הסידור לשבוע זה? כל העובדים יקבלו התראה על הביטול.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                            >
                                כן, מחק
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Publish confirmation dialog ────────────────────────────────── */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" dir="rtl">
                        <h2 className="text-lg font-bold text-gray-800">פרסום סידור עבודה</h2>
                        <p className="text-gray-600 text-sm">
                            האם לפרסם את הסידור לעובדים? לאחר הפרסום לא ניתן לשנות את הסידור.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handlePublish}
                                className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                            >
                                כן, פרסם
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ──────────────────────────────────────────────────────── */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg text-white font-medium z-50 transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.text}
                </div>
            )}
        </div>
    );
}

// ─── Skeleton & Empty State ───────────────────────────────────────────────────

/**
 * Loading skeleton shown while the schedule is being fetched.
 */
function ScheduleLoadingSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-full mb-4" />
            {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-2 mb-3">
                    <div className="h-16 bg-gray-100 rounded w-20" />
                    {[...Array(7)].map((_, j) => (
                        <div key={j} className="h-16 bg-gray-100 rounded flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * Empty state shown when no schedule has been generated for the selected week.
 */
function EmptyScheduleState() {
    return (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-200">
            <svg
                className="w-14 h-14 mx-auto mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
            </svg>
            <p className="text-lg font-medium text-gray-500">לא נוצר סידור לשבוע זה</p>
            <p className="text-sm text-gray-400 mt-1">לחץ על "צור סידור" כדי להתחיל</p>
        </div>
    );
}
