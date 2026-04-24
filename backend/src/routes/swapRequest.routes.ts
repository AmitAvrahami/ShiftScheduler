import { Router } from 'express';
import { verifyToken, isAdmin } from '../middleware/authMiddleware';
import {
  getSwapRequests,
  createSwapRequest,
  getSwapRequestById,
  updateSwapRequest,
  deleteSwapRequest,
} from '../controllers/swapRequestController';

const router = Router();

router.get('/', verifyToken, getSwapRequests);
router.post('/', verifyToken, createSwapRequest);
router.get('/:id', verifyToken, getSwapRequestById);
router.patch('/:id', verifyToken, updateSwapRequest);
router.delete('/:id', verifyToken, isAdmin, deleteSwapRequest);

export default router;
