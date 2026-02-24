import { collection, query, where, onSnapshot, writeBatch, doc, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import type { Shift, Employee, Role } from '../../../types';
import { startOfWeek, addDays, setHours, setMinutes } from 'date-fns';

export const subscribeToEmployees = (callback: (employees: Employee[]) => void) => {
    const q = query(collection(db, 'employees'));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });
};

export const subscribeToRoles = (callback: (roles: Role[]) => void) => {
    const q = query(collection(db, 'roles'));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
    });
};

export const subscribeToShifts = (
    weekStartDate: Date,
    weekEndDate: Date,
    callback: (shifts: Shift[]) => void
) => {
    const q = query(
        collection(db, 'shifts'),
        where('start_time', '>=', weekStartDate.toISOString()),
        where('start_time', '<=', weekEndDate.toISOString())
    );

    return onSnapshot(q, (snapshot) => {
        const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift));
        callback(shifts);
    });
};

export const seedMockData = async () => {
    const batch = writeBatch(db);

    // Roles
    const roles: Omit<Role, 'id'>[] = [
        { title: 'Manager', color_code: '#E53935' },
        { title: 'Barista', color_code: '#43A047' },
        { title: 'Cashier', color_code: '#1E88E5' },
    ];

    const roleIds = [];
    for (const r of roles) {
        const ref = doc(collection(db, 'roles'));
        roleIds.push(ref.id);
        batch.set(ref, r);
    }

    // Employees
    const employees: Omit<Employee, 'id'>[] = [
        {
            first_name: 'Amit',
            last_name: 'Mac',
            email: 'amit@example.com',
            phone_number: '555-0101',
            role_ids: [roleIds[0]], // Manager
            preferences: {
                target_shifts_per_week: 5,
                min_shifts_per_week: 3,
                max_shifts_per_week: 6,
                constraints: [
                    {
                        id: 'c1',
                        day_of_week: 0, // Sunday
                        part_of_day: 'afternoon',
                        start_time: '14:45',
                        end_time: '20:00',
                        type: 'mandatory_unavailability',
                        description: 'Basketball practice'
                    }
                ]
            },
            created_at: new Date().toISOString()
        },
        {
            first_name: 'Sarah',
            last_name: 'Connor',
            email: 'sarah@example.com',
            phone_number: '555-0102',
            role_ids: [roleIds[1]], // Barista
            preferences: {
                target_shifts_per_week: 4,
                min_shifts_per_week: 3,
                max_shifts_per_week: 5,
                constraints: []
            },
            created_at: new Date().toISOString()
        },
        {
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            phone_number: '555-0103',
            role_ids: [roleIds[1], roleIds[2]], // Barista & Cashier
            preferences: {
                target_shifts_per_week: 3,
                min_shifts_per_week: 2,
                max_shifts_per_week: 4,
                constraints: [
                    {
                        id: 'c2',
                        day_of_week: 2, // Tuesday
                        part_of_day: 'morning',
                        type: 'preferred',
                        description: 'Likes morning shifts'
                    }
                ]
            },
            created_at: new Date().toISOString()
        },
    ];

    const empIds = [];
    for (const e of employees) {
        const ref = doc(collection(db, 'employees'));
        empIds.push(ref.id);
        batch.set(ref, e);
    }

    // Shifts
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

    const locations = ['loc_1']; // mock location

    for (let i = 0; i < 5; i++) { // 5 shifts this week
        const shiftDate = addDays(currentWeekStart, i);
        const startTime = setMinutes(setHours(shiftDate, 9), 0);
        const endTime = setMinutes(setHours(shiftDate, 17), 0);

        const ref = doc(collection(db, 'shifts'));
        batch.set(ref, {
            employee_id: empIds[i % 3],
            role_id: roleIds[i % 3],
            location_id: locations[0],
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            assigned_date: today.toISOString(),
            break_duration_minutes: 30,
            status: 'scheduled'
        });
    }

    await batch.commit();
};

export const addEmployee = async (data: Omit<Employee, 'id' | 'created_at'>) => {
    const employeeData = {
        ...data,
        created_at: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, 'employees'), employeeData);
    return docRef.id;
};

export const updateEmployee = async (id: string, data: Partial<Omit<Employee, 'id' | 'created_at'>>) => {
    const docRef = doc(db, 'employees', id);
    // Use writeBatch or direct update; updateDoc wasn't imported initially, let's just use it
    // Wait, updateDoc is from 'firebase/firestore'. The file currently doesn't import updateDoc.
    // Instead of messing with imports in a small chunk, let's just use the current approach. 
    // Actually, I can just append import if needed, or use a batch for single update.
    const batch = writeBatch(db);
    batch.update(docRef, data);
    await batch.commit();
};

export const deleteEmployee = async (id: string) => {
    const docRef = doc(db, 'employees', id);
    const batch = writeBatch(db);
    batch.delete(docRef);
    await batch.commit();
};
