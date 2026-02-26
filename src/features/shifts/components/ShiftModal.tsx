import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod';
import { X, Loader2 } from 'lucide-react';
import type { Employee, Role } from '../../../types';
import toast from 'react-hot-toast';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SHIFT_HOURS, type ShiftPeriod } from '../../../config/shifts';

/**
 * Builds the shift Zod schema with translated error messages.
 * Called inside the component so messages re-evaluate on language change.
 *
 * @param t - Translation function from useLanguage()
 */
function buildShiftSchema(t: (key: string) => string) {
    return z
        .object({
            employee_id: z.string().min(1, t('shiftModal.validation.employeeRequired')),
            role_id: z.string().min(1, t('shiftModal.validation.roleRequired')),
            date: z.string().min(1, t('shiftModal.validation.dateRequired')),
            startTime: z.string().min(1, t('shiftModal.validation.startTimeRequired')),
            endTime: z.string().min(1, t('shiftModal.validation.endTimeRequired')),
            notes: z.string().optional(),
        })
        .refine((data) => {
            // Allow overnight shifts (e.g. night 22:45 → 06:45 next day)
            if (data.startTime >= '20:00' && data.endTime <= '08:00') return true;
            return data.startTime < data.endTime;
        }, {
            message: t('shiftModal.validation.endAfterStart'),
            path: ['endTime'],
        });
}

type ShiftFormValues = z.infer<ReturnType<typeof buildShiftSchema>>;

interface ShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    roles: Role[];
    onAddShift: (shiftData: any) => Promise<string>;
}

/**
 * Modal dialog for creating a new shift.
 * All labels are translated dynamically; Zod validation messages
 * are also localised by passing `t` into the schema builder.
 */
export function ShiftModal({ isOpen, onClose, employees, roles, onAddShift }: ShiftModalProps) {
    const { t } = useLanguage();
    const shiftSchema = buildShiftSchema(t);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<ShiftFormValues>({
        resolver: zodResolver(shiftSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '17:00',
        },
    });

    const [selectedPeriod, setSelectedPeriod] = useState<ShiftPeriod | ''>('');

    // Reset period selection whenever the modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedPeriod('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const formatTimeValue = (hour: number, minute: number) =>
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const handlePeriodSelect = (period: ShiftPeriod) => {
        setSelectedPeriod(period);
        const cfg = SHIFT_HOURS[period];
        setValue('startTime', formatTimeValue(cfg.startHour, cfg.startMinute), { shouldValidate: true });
        setValue('endTime', formatTimeValue(cfg.endHour, cfg.endMinute), { shouldValidate: true });
    };

    /**
     * Submits shift data to Firestore.
     * @param data - Validated form values
     */
    const onSubmit = async (data: ShiftFormValues) => {
        try {
            const startDateTime = new Date(`${data.date}T${data.startTime}:00`).toISOString();

            // For overnight shifts (end time < start time), end falls on the next day
            const endDate = new Date(`${data.date}T${data.endTime}:00`);
            if (data.endTime < data.startTime) {
                endDate.setDate(endDate.getDate() + 1);
            }
            const endDateTime = endDate.toISOString();

            await onAddShift({
                employee_id: data.employee_id,
                role_id: data.role_id,
                start_time: startDateTime,
                end_time: endDateTime,
                assigned_date: startDateTime,
                status: 'scheduled',
            });

            toast.success(t('shiftModal.shiftCreated'));
            reset();
            setSelectedPeriod('');
            onClose();
        } catch {
            toast.error(t('shiftModal.shiftFailed'));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                {/* Modal header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800">{t('shiftModal.title')}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        id="shift-modal-close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    {/* Employee */}
                    <div>
                        <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('shiftModal.employee')}
                        </label>
                        <select
                            id="employee_id"
                            {...register('employee_id')}
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                            <option value="">{t('shiftModal.selectEmployee')}</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.first_name} {emp.last_name}
                                </option>
                            ))}
                        </select>
                        {errors.employee_id && (
                            <p className="text-red-500 text-sm mt-1">{errors.employee_id.message}</p>
                        )}
                    </div>

                    {/* Role */}
                    <div>
                        <label htmlFor="role_id" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('shiftModal.role')}
                        </label>
                        <select
                            id="role_id"
                            {...register('role_id')}
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                            <option value="">{t('shiftModal.selectRole')}</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.title}
                                </option>
                            ))}
                        </select>
                        {errors.role_id && (
                            <p className="text-red-500 text-sm mt-1">{errors.role_id.message}</p>
                        )}
                    </div>

                    {/* Date */}
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('shiftModal.date')}
                        </label>
                        <input
                            id="date"
                            type="date"
                            {...register('date')}
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        {errors.date && (
                            <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>
                        )}
                    </div>

                    {/* Shift Period Quick-Select */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('shiftModal.shiftType')}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['morning', 'afternoon', 'night'] as ShiftPeriod[]).map((period) => {
                                const cfg = SHIFT_HOURS[period];
                                const start = formatTimeValue(cfg.startHour, cfg.startMinute);
                                const end = formatTimeValue(cfg.endHour, cfg.endMinute);
                                return (
                                    <button
                                        key={period}
                                        type="button"
                                        onClick={() => handlePeriodSelect(period)}
                                        className={`flex flex-col items-center py-2 px-1 rounded-md border text-sm transition-colors ${
                                            selectedPeriod === period
                                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span className="font-medium">{t(`shiftModal.${period}`)}</span>
                                        <span className="text-xs opacity-70">{start}–{end}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Start / End Times */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                                {t('shiftModal.startTime')}
                            </label>
                            <input
                                id="startTime"
                                type="time"
                                {...register('startTime')}
                                className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            {errors.startTime && (
                                <p className="text-red-500 text-sm mt-1">{errors.startTime.message}</p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
                                {t('shiftModal.endTime')}
                            </label>
                            <input
                                id="endTime"
                                type="time"
                                {...register('endTime')}
                                className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            {errors.endTime && (
                                <p className="text-red-500 text-sm mt-1">{errors.endTime.message}</p>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('shiftModal.notes')}
                        </label>
                        <textarea
                            id="notes"
                            {...register('notes')}
                            rows={3}
                            placeholder={t('shiftModal.notesPlaceholder')}
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        />
                    </div>

                    {/* Footer actions */}
                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            id="shift-modal-cancel"
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            {t('shiftModal.cancel')}
                        </button>
                        <button
                            type="submit"
                            id="shift-modal-submit"
                            disabled={isSubmitting}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : null}
                            {t('shiftModal.saveShift')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
