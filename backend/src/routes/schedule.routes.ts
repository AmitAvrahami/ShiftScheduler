import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
    res.json({ message: 'Schedules endpoint' });
});

export default router;
