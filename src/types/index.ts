export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night' | 'all_day';

export interface EmployeeConstraint {
    id: string;
    day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
    part_of_day: PartOfDay;
    start_time?: string;
    end_time?: string;
    type: 'mandatory_unavailability' | 'preferred' | 'less_preferred';
    description?: string;
}

export interface EmployeePreferences {
    target_shifts_per_week: number;
    min_shifts_per_week: number;
    max_shifts_per_week: number;
    constraints: EmployeeConstraint[];
}

export interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    avatar_url?: string;
    role_ids: string[];
    preferences: EmployeePreferences;
    created_at: string | Date;
}

export interface Role {
    id: string;
    title: string;
    color_code: string;
}

export interface Location {
    id: string;
    name: string;
    address: string;
}

export interface Shift {
    id: string;
    employee_id: string;
    role_id: string;
    location_id: string;
    start_time: string | Date;
    end_time: string | Date;
    assigned_date: string | Date;
    break_duration_minutes: number;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}
