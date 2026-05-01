export interface UserStats {
  total: number;
  active: number;
  byRole: { employee: number; manager: number; admin: number };
}

export interface ScheduleStats {
  total: number;
  byStatus: Record<string, number>;
}

export interface DashboardResponse {
  success: true;
  data: {
    users: UserStats;
    schedules: ScheduleStats;
    recentAuditLogs: Array<{ action: string; performedBy: string; createdAt: string }>;
  };
}
