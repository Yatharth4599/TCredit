import { Router } from 'express';
import healthRoutes from './health.js';
import vaultRoutes from './vaults.js';
import merchantRoutes from './merchants.js';
import poolRoutes from './pools.js';
import platformRoutes from './platform.js';
import investmentRoutes from './investments.js';
import paymentRoutes from './payments.js';
import oracleRoutes from './oracle.js';

const router = Router();

// Health
router.use('/', healthRoutes);

// Core API
router.use('/vaults', vaultRoutes);
router.use('/merchants', merchantRoutes);
router.use('/pools', poolRoutes);
router.use('/platform', platformRoutes);
router.use('/payments', paymentRoutes);
router.use('/oracle', oracleRoutes);

// Investment endpoints
router.use('/', investmentRoutes);

// Backward-compat: frontend client.ts calls /merchant/:id/stats (singular, no /v1)
// Mirror /merchants under /merchant so both paths work
router.use('/merchant', merchantRoutes);

export default router;
