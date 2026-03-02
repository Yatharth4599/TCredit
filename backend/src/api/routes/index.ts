import { Router } from 'express';
import healthRoutes from './health.js';
import vaultRoutes from './vaults.js';
import merchantRoutes from './merchants.js';
import poolRoutes from './pools.js';
import platformRoutes from './platform.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/vaults', vaultRoutes);
router.use('/merchants', merchantRoutes);
router.use('/pools', poolRoutes);
router.use('/platform', platformRoutes);

export default router;
