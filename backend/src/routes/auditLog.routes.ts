import { Router } from 'express';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';
import { getAuditLogs, getAuditLogById } from '../controllers/auditLogController';

const router = Router();

router.get('/', verifyToken, isAdmin, getAuditLogs);
router.get('/:id', verifyToken, isAdmin, getAuditLogById);

export default router;
