import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Loader2 } from 'lucide-react';
import type { Employee, Role } from '../../../types';
import toast from 'react-hot-toast';

const shiftSchema = z.object({
    employee_id: z.string().min(1, 'Employee is required'),
    role_id: z.string().min(1, 'Role is required'),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    notes: z.string().optional(),
}).refine((data) => {
    return data.startTime < data.endTime;
}, {
    message: "End time must be after start time",
    path: ["endTime"],
});

type ShiftFormValues = z.infer<typeof shiftSchema>;

interface ShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    roles: Role[];
    onAddShift: (shiftData: any) => Promise<string>;
}

export function ShiftModal({ isOpen, onClose, employees, roles, onAddShift }: ShiftModalProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ShiftFormValues>({
        resolver: zodResolver(shiftSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '17:00',
        },
    });

    if (!isOpen) return null;

    const onSubmit = async (data: ShiftFormValues) => {
        try {
            const startDateTime = new Date(`${data.date}T${data.startTime}:00`).toISOString();
            const endDateTime = new Date(`${data.date}T${data.endTime}:00`).toISOString();

            await onAddShift({
                employee_id: data.employee_id,
                role_id: data.role_id,
                start_time: startDateTime,
                end_time: endDateTime,
                assigned_date: startDateTime,
                status: 'scheduled',
            });

            toast.success('Shift created successfully!');
            reset();
            onClose();
        } catch (error) {
            toast.error('Failed to create shift.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800">Add New Shift</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                        <select
                            id="employee_id"
                            {...register('employee_id')}
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                            <option value="">Select an employee...</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.first_name} {emp.last_name}
                                </option>
                            ))}
                        </select>
                        {errors.employee_id && <p className="text-red-500 text-sm mt-1">{errors.employee_id.message}</p>}
                    </div>

                    <div>
                        <label htmlFor="role_id" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                            id="role_id"
                            {...register('role_id')}
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                            <option value="">Select a role...</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.title}
                                </option>
                            ))}
                        </select>
                        {errors.role_id && <p className="text-red-500 text-sm mt-1">{errors.role_id.message}</p>}
                    </div>

                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                            id="date"
                            type="date"
                            {...register('date')}
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                            <input
                                id="startTime"
                                type="time"
                                {...register('startTime')}
                                className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            {errors.startTime && <p className="text-red-500 text-sm mt-1">{errors.startTime.message}</p>}
                        </div>
                        <div>
                            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                            <input
                                id="endTime"
                                type="time"
                                {...register('endTime')}
                                className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            {errors.endTime && <p className="text-red-500 text-sm mt-1">{errors.endTime.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                        <textarea
                            id="notes"
                            {...register('notes')}
                            rows={3}
                            placeholder="Add any specific instructions..."
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        />
                    </div>

                    <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Save Shift
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
