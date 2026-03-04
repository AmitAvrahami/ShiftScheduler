export interface User {
    _id: string;
    name: string;
    email: string;
    role: 'manager' | 'employee';
    isActive: boolean;
    isFixedMorning: boolean;
}

export interface Constraint {
    _id: string;
    user: string;
    weekStartDate: string;
    date: string;
    shifts: ('morning' | 'afternoon' | 'night')[];
    reason?: string;
}

export interface Shift {
    date: string;
    type: 'morning' | 'afternoon' | 'night';
    employees: string[];
}

export interface Schedule {
    _id: string;
    weekStartDate: string;
    shifts: Shift[];
    isPublished: boolean;
}
