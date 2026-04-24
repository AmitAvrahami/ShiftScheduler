import { Request, Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog';
import AppError from '../utils/AppError';

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filter: Record<string, unknown> = {};

    if (req.query.action) filter.action = req.query.action;
    if (req.query.performedBy) filter.performedBy = req.query.performedBy;
    if (req.query.targetUserId) filter.targetUserId = req.query.targetUserId;

    if (req.query.from || req.query.to) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.from) dateFilter.$gte = new Date(req.query.from as string);
      if (req.query.to) dateFilter.$lte = new Date(req.query.to as string);
      filter.createdAt = dateFilter;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ success: true, logs, total, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) return next(new AppError('Audit log not found', 404));
    res.json({ success: true, log });
  } catch (err) {
    next(err);
  }
}
