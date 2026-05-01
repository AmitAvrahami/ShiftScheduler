import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import WeeklySchedule from '../models/WeeklySchedule';
import AuditLog from '../models/AuditLog';
import type { DashboardResponse } from '../types/admin';

export async function getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [totalUsers, activeUsers, roleCounts, totalSchedules, statusCounts, recentLogs] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ]),
        WeeklySchedule.countDocuments(),
        WeeklySchedule.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        AuditLog.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('performedBy', 'name')
          .lean(),
      ]);

    const byRole = { employee: 0, manager: 0, admin: 0 };
    for (const { _id, count } of roleCounts) {
      if (_id === 'employee' || _id === 'manager' || _id === 'admin') {
        byRole[_id] = count;
      }
    }

    const byStatus: Record<string, number> = {};
    for (const { _id, count } of statusCounts) {
      byStatus[_id] = count;
    }

    const body: DashboardResponse = {
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers, byRole },
        schedules: { total: totalSchedules, byStatus },
        recentAuditLogs: recentLogs.map((log) => ({
          action: log.action,
          performedBy:
            (log.performedBy as unknown as { name?: string } | null)?.name ??
            String(log.performedBy),
          createdAt: (log.createdAt as Date).toISOString(),
        })),
      },
    };

    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
}
