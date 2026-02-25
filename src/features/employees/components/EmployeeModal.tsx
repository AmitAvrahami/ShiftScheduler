import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Employee, Role } from '../../../types';
import { useLanguage } from '../../../i18n/LanguageContext';

/**
 * Builds Zod schemas for employee form with translated error messages.
 * Called inside the component so messages re-evaluate when language changes.
 *
 * @param t - Translation function from useLanguage()
 */
function buildEmployeeSchema(t: (key: string) => string) {
    const constraintSchema = z
        .object({
            id: z.string().optional(),
            day_of_week: z.number().min(0).max(6),
            part_of_day: z.enum(['morning', 'afternoon', 'evening', 'night', 'all_day']),
            start_time: z.string().optional(),
            end_time: z.string().optional(),
            type: z.enum(['mandatory_unavailability', 'preferred', 'less_preferred']),
            description: z.string().optional(),
        })
        .refine(
            (data) => {
                if (data.start_time && data.end_time) {
                    const start = new Date(`1970-01-01T${data.start_time}:00`);
                    const end = new Date(`1970-01-01T${data.end_time}:00`);
                    return end > start;
                }
                return true;
            },
            {
                message: t('employeeModal.validation.endAfterStart'),
                path: ['end_time'],
            }
        );

    return z
        .object({
            first_name: z.string().min(2, t('employeeModal.validation.firstNameRequired')),
            last_name: z.string().min(2, t('employeeModal.validation.lastNameRequired')),
            email: z.string().email(t('employeeModal.validation.emailInvalid')),
            phone_number: z.string().min(1, t('employeeModal.validation.phoneRequired')),
            role_ids: z.array(z.string()).min(1, t('employeeModal.validation.roleRequired')),
            preferences: z.object({
                target_shifts_per_week: z.number().min(0, t('employeeModal.validation.mustBePositive')),
                min_shifts_per_week: z.number().min(0, t('employeeModal.validation.mustBePositive')),
                max_shifts_per_week: z.number().min(1, t('employeeModal.validation.minAtLeastOne')),
                constraints: z.array(constraintSchema),
            }),
        })
        .refine(
            (data) =>
                data.preferences.min_shifts_per_week <= data.preferences.max_shifts_per_week,
            {
                message: t('employeeModal.validation.minNotGreaterThanMax'),
                path: ['preferences', 'max_shifts_per_week'],
            }
        );
}

type EmployeeFormData = z.infer<ReturnType<typeof buildEmployeeSchema>>;

interface EmployeeModalProps {
    /** Whether the modal is visible */
    isOpen: boolean;
    /** Callback to close the modal */
    onClose: () => void;
    /** Persist form data */
    onSave: (data: Omit<Employee, 'id' | 'created_at'>) => void;
    /** Pre-populate form when editing an existing employee */
    employee?: Employee;
    /** Available roles for selection */
    roles: Role[];
}

/**
 * Full-featured modal for creating or editing an employee record.
 * Sections: Personal Info, Roles, Shift Preferences, Weekly Constraints.
 * All labels are translated and Zod validation messages are localised.
 */
export const EmployeeModal: React.FC<EmployeeModalProps> = ({
    isOpen,
    onClose,
    onSave,
    employee,
    roles,
}) => {
    const { t } = useLanguage();
    const employeeSchema = buildEmployeeSchema(t);

    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<EmployeeFormData>({
        resolver: zodResolver(employeeSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            email: '',
            phone_number: '',
            role_ids: [],
            preferences: {
                target_shifts_per_week: 5,
                min_shifts_per_week: 3,
                max_shifts_per_week: 6,
                constraints: [],
            },
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'preferences.constraints',
    });

    /** Sync form values when the modal opens or the employee prop changes */
    useEffect(() => {
        if (isOpen) {
            if (employee) {
                reset({
                    first_name: employee.first_name,
                    last_name: employee.last_name,
                    email: employee.email,
                    phone_number: employee.phone_number,
                    role_ids: employee.role_ids,
                    preferences: employee.preferences,
                });
            } else {
                reset({
                    first_name: '',
                    last_name: '',
                    email: '',
                    phone_number: '',
                    role_ids: [],
                    preferences: {
                        target_shifts_per_week: 5,
                        min_shifts_per_week: 3,
                        max_shifts_per_week: 6,
                        constraints: [],
                    },
                });
            }
        }
    }, [isOpen, employee, reset]);

    if (!isOpen) return null;

    /**
     * Handles form submission — ensures each constraint has a unique id.
     * @param data - Validated employee form values
     */
    const onSubmit = (data: EmployeeFormData) => {
        const submissionData: Omit<Employee, 'id' | 'created_at'> = {
            ...data,
            preferences: {
                ...data.preferences,
                constraints: data.preferences.constraints.map((c) => ({
                    ...c,
                    id: c.id || crypto.randomUUID(),
                })),
            },
        };
        onSave(submissionData);
        onClose();
    };

    /** Days translated in the active language */
    const translatedDays = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
        value: i,
        label: t(`day.${i}`),
    }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {employee ? t('employeeModal.editTitle') : t('employeeModal.addTitle')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        id="employee-modal-close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                    {/* ── Personal Info ──────────────────────────── */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            {t('employeeModal.personalInfo')}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('employeeModal.firstName')}
                                </label>
                                <input
                                    id="first_name"
                                    type="text"
                                    {...register('first_name')}
                                    className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                {errors.first_name && (
                                    <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
                                )}
                            </div>
                            <div>
                                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('employeeModal.lastName')}
                                </label>
                                <input
                                    id="last_name"
                                    type="text"
                                    {...register('last_name')}
                                    className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                {errors.last_name && (
                                    <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('employeeModal.email')}
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    {...register('email')}
                                    className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                {errors.email && (
                                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                                )}
                            </div>
                            <div>
                                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('employeeModal.phoneNumber')}
                                </label>
                                <input
                                    id="phone_number"
                                    type="tel"
                                    {...register('phone_number')}
                                    className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                {errors.phone_number && (
                                    <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-200" />

                    {/* ── Roles ──────────────────────────────────── */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            {t('employeeModal.roles')}
                        </h3>
                        <div>
                            <label htmlFor="role_ids" className="block text-sm font-medium text-gray-700 mb-1">
                                {t('employeeModal.assignedRoles')}
                            </label>
                            <select
                                id="role_ids"
                                multiple
                                {...register('role_ids')}
                                className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 outline-none h-24"
                            >
                                {roles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                        {role.title}
                                    </option>
                                ))}
                            </select>
                            {errors.role_ids && (
                                <p className="mt-1 text-sm text-red-600">{errors.role_ids.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-gray-200" />

                    {/* ── Shift Preferences ──────────────────────── */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                            {t('employeeModal.shiftPreferences')}
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="target_shifts" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('employeeModal.targetShifts')}
                                </label>
                                <input
                                    id="target_shifts"
                                    type="number"
                                    {...register('preferences.target_shifts_per_week', { valueAsNumber: true })}
                                    className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                {errors.preferences?.target_shifts_per_week && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.preferences.target_shifts_per_week.message}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label htmlFor="min_shifts" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('employeeModal.minShifts')}
                                </label>
                                <input
                                    id="min_shifts"
                                    type="number"
                                    {...register('preferences.min_shifts_per_week', { valueAsNumber: true })}
                                    className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                {errors.preferences?.min_shifts_per_week && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.preferences.min_shifts_per_week.message}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label htmlFor="max_shifts" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('employeeModal.maxShifts')}
                                </label>
                                <input
                                    id="max_shifts"
                                    type="number"
                                    {...register('preferences.max_shifts_per_week', { valueAsNumber: true })}
                                    className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                {errors.preferences?.max_shifts_per_week && (
                                    <p className="mt-1 text-sm text-red-600">
                                        {errors.preferences.max_shifts_per_week.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-200" />

                    {/* ── Weekly Constraints ─────────────────────── */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-gray-900">
                                {t('employeeModal.weeklyConstraints')}
                            </h3>
                            <button
                                type="button"
                                onClick={() =>
                                    append({
                                        id: crypto.randomUUID(),
                                        day_of_week: 0,
                                        part_of_day: 'all_day',
                                        type: 'mandatory_unavailability',
                                        description: '',
                                    })
                                }
                                className="flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                                id="employee-add-constraint"
                            >
                                <Plus className="w-4 h-4 me-1" />
                                {t('employeeModal.addConstraint')}
                            </button>
                        </div>

                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="p-4 bg-gray-50 border border-gray-200 rounded-lg relative"
                                >
                                    {/* Remove constraint button */}
                                    <button
                                        type="button"
                                        onClick={() => remove(index)}
                                        className="absolute top-2 end-2 text-gray-400 hover:text-red-500"
                                        id={`employee-remove-constraint-${index}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    {/* Type + Day */}
                                    <div className="grid grid-cols-2 gap-4 mb-3 pe-6">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                {t('employeeModal.constraintType')}
                                            </label>
                                            <select
                                                {...register(`preferences.constraints.${index}.type` as const)}
                                                className="w-full rounded-md border border-gray-300 p-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="mandatory_unavailability">
                                                    {t('employeeModal.mandatory_unavailability')}
                                                </option>
                                                <option value="preferred">
                                                    {t('employeeModal.preferred')}
                                                </option>
                                                <option value="less_preferred">
                                                    {t('employeeModal.less_preferred')}
                                                </option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                {t('employeeModal.constraintDay')}
                                            </label>
                                            <select
                                                {...register(
                                                    `preferences.constraints.${index}.day_of_week` as const,
                                                    { valueAsNumber: true }
                                                )}
                                                className="w-full rounded-md border border-gray-300 p-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                                {translatedDays.map(({ value, label }) => (
                                                    <option key={value} value={value}>
                                                        {label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Part of Day + Times */}
                                    <div className="grid grid-cols-3 gap-4 mb-3 pe-6">
                                        <div>
                                            <label
                                                htmlFor={`part_of_day_${index}`}
                                                className="block text-xs font-medium text-gray-700 mb-1"
                                            >
                                                {t('employeeModal.partOfDay')}
                                            </label>
                                            <select
                                                id={`part_of_day_${index}`}
                                                {...register(
                                                    `preferences.constraints.${index}.part_of_day` as const
                                                )}
                                                className="w-full rounded-md border border-gray-300 p-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="all_day">{t('employeeModal.all_day')}</option>
                                                <option value="morning">{t('employeeModal.morning')}</option>
                                                <option value="afternoon">{t('employeeModal.afternoon')}</option>
                                                <option value="evening">{t('employeeModal.evening')}</option>
                                                <option value="night">{t('employeeModal.night')}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label
                                                htmlFor={`start_time_${index}`}
                                                className="block text-xs font-medium text-gray-700 mb-1"
                                            >
                                                {t('employeeModal.startTimeOpt')}
                                            </label>
                                            <input
                                                id={`start_time_${index}`}
                                                type="time"
                                                {...register(
                                                    `preferences.constraints.${index}.start_time` as const
                                                )}
                                                className="w-full rounded-md border border-gray-300 p-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label
                                                htmlFor={`end_time_${index}`}
                                                className="block text-xs font-medium text-gray-700 mb-1"
                                            >
                                                {t('employeeModal.endTimeOpt')}
                                            </label>
                                            <input
                                                id={`end_time_${index}`}
                                                type="time"
                                                {...register(
                                                    `preferences.constraints.${index}.end_time` as const
                                                )}
                                                className="w-full rounded-md border border-gray-300 p-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                            {errors.preferences?.constraints?.[index]?.end_time && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errors.preferences.constraints[index]?.end_time?.message}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="pe-6">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            {t('employeeModal.description')}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={t('employeeModal.descriptionPlaceholder')}
                                            {...register(
                                                `preferences.constraints.${index}.description` as const
                                            )}
                                            className="w-full rounded-md border border-gray-300 p-1.5 text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            ))}

                            {fields.length === 0 && (
                                <p className="text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    {t('employeeModal.noConstraints')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── Footer Actions ─────────────────────────── */}
                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-8">
                        <button
                            type="button"
                            onClick={onClose}
                            id="employee-modal-cancel"
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            {t('employeeModal.cancel')}
                        </button>
                        <button
                            type="submit"
                            id="employee-modal-submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                        >
                            {t('employeeModal.saveEmployee')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
