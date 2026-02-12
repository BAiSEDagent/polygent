import { Router } from 'express';
import agentsRouter from './agents';
import ordersRouter from './orders';
import marketsRouter from './markets';
import portfolioRouter from './portfolio';

const router = Router();

router.use('/agents', agentsRouter);
router.use('/orders', ordersRouter);
router.use('/markets', marketsRouter);
router.use('/portfolio', portfolioRouter);

export default router;
