import { Router } from 'express';
import { verifyToken, isManager, isAdmin } from '../middleware/authMiddleware';
import {
  getSettings,
  getSettingByKey,
  upsertSetting,
  deleteSetting,
} from '../controllers/settingsController';

const router = Router();

router.get('/', verifyToken, isManager, getSettings);
router.get('/:key', verifyToken, isManager, getSettingByKey);
router.put('/:key', verifyToken, isAdmin, upsertSetting);
router.delete('/:key', verifyToken, isAdmin, deleteSetting);

export default router;
