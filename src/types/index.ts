export interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    avatar_url?: string;
    total_hours_per_week: number;
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
