import { Router } from 'express';
import type { Address } from 'viem';
import { encodeFunctionData } from 'viem';
import { getAgentIdentity } from '../../chain/agentIdentity.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const IDENTITY_ADDRESS = (process.env.AGENT_IDENTITY_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address;

// Minimal ABI for mint
const AgentIdentityMintABI = [
  {
    inputs: [{ name: 'agent', type: 'address' }],
    name: 'mintIdentity',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// GET /api/v1/identity/:address — get agent identity + reputation
router.get('/:address', async (req, res, next) => {
  try {
    const agent = req.params.address as Address;
    const data = await getAgentIdentity(IDENTITY_ADDRESS, agent);
    res.json({ agent, ...data });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/identity/mint — build unsigned mint tx
router.post('/mint', async (req, res, next) => {
  try {
    const { agent } = req.body;
    if (!agent) throw new AppError(400, 'agent address required');
    const data = encodeFunctionData({
      abi: AgentIdentityMintABI,
      functionName: 'mintIdentity',
      args: [agent as Address],
    });
    res.json({
      to: IDENTITY_ADDRESS,
      data,
      description: `Mint Krexa Identity NFT for ${agent}`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/identity/:address/score — just the reputation score
router.get('/:address/score', async (req, res, next) => {
  try {
    const agent = req.params.address as Address;
    const data = await getAgentIdentity(IDENTITY_ADDRESS, agent);
    res.json({
      agent,
      score: data.reputationScore,
      hasIdentity: data.hasIdentity,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
