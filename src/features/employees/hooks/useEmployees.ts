import { useState, useCallback, useEffect } from 'react';
import { subscribeToEmployees, subscribeToRoles, addEmployee, updateEmployee, deleteEmployee } from '../../shifts/services/firestoreService';
import type { Employee, Role } from '../../../types';

export function useEmployees() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [error] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribeEmployees = subscribeToEmployees((data) => {
            setEmployees(data);
            setLoading(false);
        });
        const unsubscribeRoles = subscribeToRoles((data) => setRoles(data));

        return () => {
            unsubscribeEmployees();
            unsubscribeRoles();
        };
    }, []);

    const add = useCallback(async (data: Omit<Employee, 'id' | 'created_at'>) => {
        try {
            return await addEmployee(data);
        } catch (err) {
            console.error('Error adding employee:', err);
            throw err;
        }
    }, []);

    const update = useCallback(async (id: string, data: Partial<Omit<Employee, 'id' | 'created_at'>>) => {
        try {
            await updateEmployee(id, data);
        } catch (err) {
            console.error('Error updating employee:', err);
            throw err;
        }
    }, []);

    const remove = useCallback(async (id: string) => {
        try {
            await deleteEmployee(id);
        } catch (err) {
            console.error('Error deleting employee:', err);
            throw err;
        }
    }, []);

    return { employees, roles, loading, error, add, update, remove };
}
