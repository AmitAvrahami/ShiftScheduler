import { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useEmployees } from '../features/employees/hooks/useEmployees';
import { EmployeeModal } from '../features/employees/components/EmployeeModal';
import type { Employee } from '../types';
import toast from 'react-hot-toast';

export function Team() {
    const { employees, roles, loading, add, update, remove } = useEmployees();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>(undefined);

    const handleOpenModal = (employee?: Employee) => {
        setEditingEmployee(employee);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingEmployee(undefined);
    };

    const handleSave = async (data: Omit<Employee, 'id' | 'created_at'>) => {
        try {
            if (editingEmployee) {
                await update(editingEmployee.id, data);
                toast.success('Employee updated successfully');
            } else {
                await add(data);
                toast.success('Employee created successfully');
            }
            handleCloseModal();
        } catch (error) {
            toast.error('Failed to save employee');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this employee?')) {
            try {
                await remove(id);
                toast.success('Employee deleted successfully');
            } catch (error) {
                toast.error('Failed to delete employee');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-euclid text-gray-900">Team Directory</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage employees, constraints, and work preferences</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Employee
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Roles</th>
                                <th className="px-6 py-4 text-center">Settings</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No employees found. Add your first employee to get started!
                                    </td>
                                </tr>
                            ) : (
                                employees.map((employee) => (
                                    <tr key={employee.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold border border-blue-200">
                                                    {employee.first_name[0]}{employee.last_name[0]}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            <div>{employee.email}</div>
                                            <div className="text-xs">{employee.phone_number}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1 flex-wrap">
                                                {employee.role_ids?.map(roleId => {
                                                    const role = roles.find(r => r.id === roleId);
                                                    return role ? (
                                                        <span
                                                            key={roleId}
                                                            className="px-2 py-1 text-xs font-medium rounded-full"
                                                            style={{ backgroundColor: `${role.color_code}20`, color: role.color_code }}
                                                        >
                                                            {role.title}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-xs text-gray-600">
                                                {employee.preferences?.target_shifts_per_week ?? 'N/A'} target shifts
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {employee.preferences?.constraints?.length ?? 0} constraints
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => handleOpenModal(employee)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(employee.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                                                title="Delete"
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
