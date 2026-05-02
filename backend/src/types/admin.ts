export interface UserStats {
  total: number;
  active: number;
  byRole: { employee: number; manager: number; admin: number };
}

export interface CurrentWeekStats {
  total: number;
  filled: number;
  partial: number;
  empty: number;
  scheduleStatus: string | null;
}

export interface AdminAuditLogEntry {
  _id: string;
  action: string;
  performedBy: { _id: string; name: string } | string;
  createdAt: string;
  ip?: string;
}

export interface DashboardResponse {
  success: true;
  data: {
    users: {
      all: Record<string, unknown>[];
      stats: UserStats;
    };
    shiftDefinitions: Record<string, unknown>[];
    currentWeek: {
      weekId: string;
      schedule: Record<string, unknown> | null;
      shifts: Record<string, unknown>[];
      assignments: Record<string, unknown>[];
      stats: CurrentWeekStats;
    };
    nextWeek: {
      weekId: string;
      missingConstraintUserIds: string[];
    };
    recentAuditLogs: AdminAuditLogEntry[];
    meta: { queryTimeMs: number };
  };
}
