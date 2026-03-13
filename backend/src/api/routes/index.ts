import { Router } from 'express';
import healthRoutes from './health.js';
import vaultRoutes from './vaults.js';
import merchantRoutes from './merchants.js';
import poolRoutes from './pools.js';
import platformRoutes from './platform.js';
import investmentRoutes from './investments.js';
import paymentRoutes from './payments.js';
import oracleRoutes from './oracle.js';
import balanceRoutes from './balance.js';
import x402Routes from './x402.js';
import walletRoutes from './wallets.js';
import gatewayRoutes from './gateway.js';
import acpRoutes from './acp.js';
import creditRoutes from './credit.js';
import identityRoutes from './identity.js';
import kickstartRoutes from './kickstart.js';
import traderRoutes from './traders.js';
import waitlistRoutes from './waitlist.js';
import adminRoutes from './admin.js';
import demoRoutes from './demo.routes.js';
import solanaWalletRoutes from './agent-wallet.routes.js';
import solanaCreditRoutes from './agent-credit.routes.js';
import solanaKyaRoutes from './kya.routes.js';
import solanaVaultRoutes from './solana-vault.routes.js';
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

// Balance
router.use('/balance', balanceRoutes);

// x402 Facilitator
router.use('/x402', x402Routes);

// Agent Wallets
router.use('/wallets', walletRoutes);

// Gateway & ACP
router.use('/gateway', gatewayRoutes);
router.use('/acp', acpRoutes);

// Credit Lines
router.use('/credit', creditRoutes);

// Agent Identity
router.use('/identity', identityRoutes);

// Kickstart (EasyA) — token launches with credit
router.use('/kickstart', kickstartRoutes);

// Polymarket Traders — credit lines based on trading history
router.use('/traders', traderRoutes);

// Waitlist
router.use('/waitlist', waitlistRoutes);

// Public demo endpoint (no auth)
router.use('/demo', demoRoutes);

// ── Solana Agent Credit System ─────────────────────────────────────────────
router.use('/solana/wallets', solanaWalletRoutes);
router.use('/solana/credit',  solanaCreditRoutes);
router.use('/solana/kya',     solanaKyaRoutes);
router.use('/solana/vault',   solanaVaultRoutes);

// Admin (API key protected)
router.use('/admin', adminRoutes);

// Investment endpoints
router.use('/', investmentRoutes);

// Backward-compat: frontend client.ts calls /merchant/:id/stats (singular, no /v1)
// Mirror /merchants under /merchant so both paths work
router.use('/merchant', merchantRoutes);

export default router;
