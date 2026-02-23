import { useState, useCallback, useEffect } from 'react';
import { subscribeToShifts, subscribeToEmployees, subscribeToRoles } from '../services/firestoreService';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import type { Shift, Employee, Role } from '../../../types';
import { startOfWeek, endOfWeek } from 'date-fns';

export function useShifts(currentDate: Date) {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        let unsubscribeShifts = () => { };

        const unsubscribeEmployees = subscribeToEmployees((data) => setEmployees(data));
        const unsubscribeRoles = subscribeToRoles((data) => setRoles(data));

        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

        unsubscribeShifts = subscribeToShifts(weekStart, weekEnd, (data) => {
            setShifts(data);
            setLoading(false);
        });

        return () => {
            unsubscribeEmployees();
            unsubscribeRoles();
            unsubscribeShifts();
        };
    }, [currentDate]);

    const addShift = useCallback(async (data: Omit<Shift, 'id'>) => {
        try {
            const docRef = await addDoc(collection(db, 'shifts'), data);
            return docRef.id;
        } catch (err) {
            console.error('Error adding shift:', err);
            throw err;
        }
    }, []);

    return { shifts, employees, roles, loading, error, addShift };
}
