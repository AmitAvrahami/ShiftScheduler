import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import SystemSettings from '../models/SystemSettings';
import AuditLog from '../models/AuditLog';
import AppError from '../utils/AppError';

const upsertSchema = z.object({
  value: z.unknown(),
  description: z.string().optional(),
});

export async function getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await SystemSettings.find({}).sort({ key: 1 });
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
}

export async function getSettingByKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const setting = await SystemSettings.findOne({ key: req.params.key });
    if (!setting) return next(new AppError('Setting not found', 404));
    res.json({ success: true, setting });
  } catch (err) {
    next(err);
  }
}

export async function upsertSetting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return next(new AppError(parsed.error.errors[0].message, 400));

    const before = await SystemSettings.findOne({ key: req.params.key });

    const setting = await SystemSettings.findOneAndUpdate(
      { key: req.params.key },
      {
        $set: {
          value: parsed.data.value,
          description: parsed.data.description,
          updatedBy: req.user!._id,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      performedBy: req.user!._id,
      action: 'setting_updated',
      refModel: 'SystemSettings',
      refId: setting._id,
      before: before?.toObject() ?? null,
      after: { key: req.params.key, value: parsed.data.value },
      ip: req.ip,
    });

    res.json({ success: true, setting });
  } catch (err) {
    next(err);
  }
}

export async function deleteSetting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const setting = await SystemSettings.findOneAndDelete({ key: req.params.key });
    if (!setting) return next(new AppError('Setting not found', 404));

    await AuditLog.create({
      performedBy: req.user!._id,
      action: 'setting_deleted',
      refModel: 'SystemSettings',
      refId: setting._id,
      before: setting.toObject(),
      ip: req.ip,
    });

    res.json({ success: true, message: 'Setting deleted' });
  } catch (err) {
    next(err);
  }
}
