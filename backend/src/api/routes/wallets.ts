import { Router } from 'express';
import type { Address } from 'viem';
import { parseUnits } from 'viem';
import { getWalletState } from '../../chain/agentWallet.js';
import {
  getWalletByOwner,
  getAllWallets,
  encodeCreateWallet,
  encodeSetLimits,
  encodeSetOperator,
  encodeSetWhitelist,
  encodeFreeze,
  encodeUnfreeze,
  encodeLinkCreditVault,
} from '../../chain/agentWalletFactory.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Factory address — set via env once deployed
const WALLET_FACTORY = (process.env.AGENT_WALLET_FACTORY_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address;

// GET /api/v1/wallets — list all wallets
router.get('/', async (req, res, next) => {
  try {
    const wallets = await getAllWallets(WALLET_FACTORY);
    const states = await Promise.all(
      wallets.map(async (addr) => {
        const state = await getWalletState(addr);
        return { address: addr, ...state };
      })
    );
    res.json({ wallets: states, total: states.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/wallets/by-owner/:address — get wallet by owner
router.get('/by-owner/:address', async (req, res, next) => {
  try {
    const owner = req.params.address as Address;
    const walletAddr = await getWalletByOwner(WALLET_FACTORY, owner);
    if (walletAddr === '0x0000000000000000000000000000000000000000') {
      throw new AppError(404, 'No wallet found for this owner');
    }
    const state = await getWalletState(walletAddr);
    res.json({ address: walletAddr, ...state });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/wallets/:address — get wallet detail
router.get('/:address', async (req, res, next) => {
  try {
    const walletAddr = req.params.address as Address;
    const state = await getWalletState(walletAddr);
    res.json({ address: walletAddr, ...state });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/wallets/create — build unsigned createWallet tx
router.post('/create', async (req, res, next) => {
  try {
    const { operator, dailyLimitUsdc, perTxLimitUsdc } = req.body;
    if (!operator) throw new AppError(400, 'operator address required');
    const daily = parseUnits(String(dailyLimitUsdc ?? '1000'), 6);
    const perTx = parseUnits(String(perTxLimitUsdc ?? '200'), 6);
    const tx = encodeCreateWallet(WALLET_FACTORY, operator as Address, daily, perTx);
    res.json({ ...tx, description: 'Create agent wallet' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/wallets/:address/set-limits — build unsigned setLimits tx
router.post('/:address/set-limits', async (req, res, next) => {
  try {
    const { dailyLimitUsdc, perTxLimitUsdc } = req.body;
    const walletAddr = req.params.address as Address;
    const daily = parseUnits(String(dailyLimitUsdc ?? '0'), 6);
    const perTx = parseUnits(String(perTxLimitUsdc ?? '0'), 6);
    const tx = encodeSetLimits(walletAddr, daily, perTx);
    res.json({ ...tx, description: 'Update wallet limits' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/wallets/:address/set-operator — build unsigned setOperator tx
router.post('/:address/set-operator', async (req, res, next) => {
  try {
    const { operator } = req.body;
    if (!operator) throw new AppError(400, 'operator address required');
    const tx = encodeSetOperator(req.params.address as Address, operator as Address);
    res.json({ ...tx, description: 'Update wallet operator' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/wallets/:address/whitelist — build unsigned setWhitelist tx
router.post('/:address/whitelist', async (req, res, next) => {
  try {
    const { recipient, allowed } = req.body;
    if (!recipient) throw new AppError(400, 'recipient address required');
    const tx = encodeSetWhitelist(req.params.address as Address, recipient as Address, Boolean(allowed));
    res.json({ ...tx, description: `${allowed ? 'Add to' : 'Remove from'} whitelist` });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/wallets/:address/freeze — build unsigned freeze tx
router.post('/:address/freeze', async (_req, res, next) => {
  try {
    const tx = encodeFreeze(_req.params.address as Address);
    res.json({ ...tx, description: 'Freeze wallet' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/wallets/:address/unfreeze — build unsigned unfreeze tx
router.post('/:address/unfreeze', async (_req, res, next) => {
  try {
    const tx = encodeUnfreeze(_req.params.address as Address);
    res.json({ ...tx, description: 'Unfreeze wallet' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/wallets/:address/link-credit — build unsigned linkCreditVault tx
router.post('/:address/link-credit', async (req, res, next) => {
  try {
    const { vault } = req.body;
    if (!vault) throw new AppError(400, 'vault address required');
    const tx = encodeLinkCreditVault(req.params.address as Address, vault as Address);
    res.json({ ...tx, description: 'Link credit vault to wallet' });
  } catch (err) {
    next(err);
  }
});

export default router;
