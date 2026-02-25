import { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useEmployees } from '../features/employees/hooks/useEmployees';
import { EmployeeModal } from '../features/employees/components/EmployeeModal';
import type { Employee } from '../types';
import toast from 'react-hot-toast';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * Team Directory page.
 * Lists all employees in a table and provides add / edit / delete actions.
 * All labels are resolved through `t()` so the page reacts to language changes.
 */
export function Team() {
    const { employees, roles, loading, add, update, remove } = useEmployees();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>(undefined);
    const { t } = useLanguage();

    /** Open the modal, optionally pre-loading an employee for editing. */
    const handleOpenModal = (employee?: Employee) => {
        setEditingEmployee(employee);
        setIsModalOpen(true);
    };

    /** Close and reset the modal. */
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEmployee(undefined);
    };

    /**
     * Persists an employee record (create or update).
     * @param data - Employee fields without id / created_at
     */
    const handleSave = async (data: Omit<Employee, 'id' | 'created_at'>) => {
        try {
            if (editingEmployee) {
                await update(editingEmployee.id, data);
                toast.success(t('team.updatedSuccess'));
            } else {
                await add(data);
                toast.success(t('team.createdSuccess'));
            }
            handleCloseModal();
        } catch {
            toast.error(t('team.saveFailed'));
        }
    };

    /**
     * Asks for confirmation then deletes an employee.
     * @param id - Employee document id
     */
    const handleDelete = async (id: string) => {
        if (window.confirm(t('team.confirmDelete'))) {
            try {
                await remove(id);
                toast.success(t('team.deletedSuccess'));
            } catch {
                toast.error(t('team.deleteFailed'));
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-euclid text-gray-900">{t('team.title')}</h1>
                    <p className="text-sm text-gray-500 mt-1">{t('team.subtitle')}</p>
                </div>
                <button
                    id="team-add-employee"
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5 me-2" />
                    {t('team.addEmployee')}
                </button>
            </div>

            {/* Employee table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-start">
                        <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-start">{t('team.tableEmployee')}</th>
                                <th className="px-6 py-4 text-start">{t('team.tableContact')}</th>
                                <th className="px-6 py-4 text-start">{t('team.tableRoles')}</th>
                                <th className="px-6 py-4 text-center">{t('team.tableSettings')}</th>
                                <th className="px-6 py-4 text-end">{t('team.tableActions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        {t('team.noEmployees')}
                                    </td>
                                </tr>
                            ) : (
                                employees.map((employee) => (
                                    <tr key={employee.id} className="hover:bg-gray-50/50 transition-colors">
                                        {/* Employee name + avatar */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold border border-blue-200 flex-shrink-0">
                                                    {employee.first_name[0]}{employee.last_name[0]}
                                                </div>
                                                <div className="ms-4">
                                                    <div className="font-medium text-gray-900">
                                                        {employee.first_name} {employee.last_name}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Contact */}
                                        <td className="px-6 py-4 text-gray-500">
                                            <div>{employee.email}</div>
                                            <div className="text-xs">{employee.phone_number}</div>
                                        </td>

                                        {/* Roles */}
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {employee.role_ids?.map((roleId) => {
                                                    const role = roles.find((r) => r.id === roleId);
                                                    return role ? (
                                                        <span
                                                            key={roleId}
                                                            className="px-2 py-1 text-xs font-medium rounded-full"
                                                            style={{
                                                                backgroundColor: `${role.color_code}20`,
                                                                color: role.color_code,
                                                            }}
                                                        >
                                                            {role.title}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        </td>

                                        {/* Preferences summary */}
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-xs text-gray-600">
                                                {t('team.targetShifts', {
                                                    count: employee.preferences?.target_shifts_per_week ?? 'N/A',
                                                })}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {t('team.constraints', {
                                                    count: employee.preferences?.constraints?.length ?? 0,
                                                })}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4 text-end space-x-2">
                                            <button
                                                onClick={() => handleOpenModal(employee)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50"
                                                title={t('team.editTooltip')}
                                                id={`team-edit-${employee.id}`}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(employee.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                                                title={t('team.deleteTooltip')}
                                                id={`team-delete-${employee.id}`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <EmployeeModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                employee={editingEmployee}
                roles={roles}
            />
        </div>
    );
}
