import { collection, query, where, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Shift, Employee, Role } from '../types';
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
        { first_name: 'Amit', last_name: 'Mac', email: 'amit@example.com', phone_number: '555-0101', total_hours_per_week: 40, created_at: new Date().toISOString() },
        { first_name: 'Sarah', last_name: 'Connor', email: 'sarah@example.com', phone_number: '555-0102', total_hours_per_week: 30, created_at: new Date().toISOString() },
        { first_name: 'John', last_name: 'Doe', email: 'john@example.com', phone_number: '555-0103', total_hours_per_week: 20, created_at: new Date().toISOString() },
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
