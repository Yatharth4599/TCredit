import { Router } from 'express';
import type { Address } from 'viem';
import { encodeFunctionData, parseEther } from 'viem';
import { env } from '../../config/env.js';
import { KickstartFactoryABI, BondingCurveABI } from '../../config/kickstart-abi.js';
import { publicClientMainnet } from '../../chain/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { addresses, MerchantVaultABI } from '../../config/contracts.js';

const router = Router();

const KICKSTART_FACTORY = env.KICKSTART_FACTORY_ADDRESS as Address;
const KICKSTART_API = env.KICKSTART_API_URL;

// POST /api/v1/kickstart/upload-metadata
// Proxy metadata upload to EasyA Kickstart API
router.post('/upload-metadata', async (req, res, next) => {
  try {
    const { name, ticker, description, imageUrl } = req.body;

    if (!name || !ticker || !description) {
      throw new AppError(400, 'name, ticker, and description are required');
    }

    // Build form data for the Kickstart metadata API
    const formData = new FormData();
    formData.append('name', name);
    formData.append('ticker', ticker);
    formData.append('description', description);

    // If imageUrl provided, fetch the image and attach it
    if (imageUrl) {
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        throw new AppError(400, `Failed to fetch image from ${imageUrl}`);
      }
      const imageBlob = await imageRes.blob();
      const ext = imageUrl.split('.').pop()?.split('?')[0] || 'png';
      formData.append('image', imageBlob, `token-image.${ext}`);
    }

    const uploadRes = await fetch(`${KICKSTART_API}/upload/metadata`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => '');
      throw new AppError(uploadRes.status, `Kickstart metadata upload failed: ${errText}`);
    }

    const result = await uploadRes.json() as Record<string, string>;
    res.json({
      uri: result.uri || result.metadataUri || result.url,
      raw: result,
      description: `Metadata uploaded for ${name} ($${ticker})`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/kickstart/create-token
// Build unsigned createToken tx for Base mainnet
router.post('/create-token', async (req, res, next) => {
  try {
    const { name, symbol, uri, deadlineSeconds, initialBuyEth } = req.body;

    if (!name || !symbol || !uri) {
      throw new AppError(400, 'name, symbol, and uri are required');
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + (deadlineSeconds ?? 86400));

    const data = encodeFunctionData({
      abi: KickstartFactoryABI,
      functionName: 'createToken',
      args: [name, symbol, uri, deadline],
    });

    res.json({
      to: KICKSTART_FACTORY,
      data,
      value: initialBuyEth ? parseEther(String(initialBuyEth)).toString() : '0',
      chainId: 8453,
      description: `Create token ${name} ($${symbol}) on Kickstart`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/kickstart/buy-token
// Build unsigned buy tx for an existing Kickstart bonding curve token
router.post('/buy-token', async (req, res, next) => {
  try {
    const { curveAddress, ethAmount, minTokensOut } = req.body;

    if (!curveAddress || !ethAmount) {
      throw new AppError(400, 'curveAddress and ethAmount are required');
    }

    const data = encodeFunctionData({
      abi: BondingCurveABI,
      functionName: 'buy',
      args: [BigInt(minTokensOut ?? 0)],
    });

    res.json({
      to: curveAddress,
      data,
      value: parseEther(String(ethAmount)).toString(),
      chainId: 8453,
      description: `Buy tokens on Kickstart curve ${curveAddress} for ${ethAmount} ETH`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/kickstart/credit-and-launch
// Combined flow: draw credit on Sepolia + create token on mainnet
// Returns ordered steps for the agent to execute
router.post('/credit-and-launch', async (req, res, next) => {
  try {
    const {
      vaultAddress,
      name,
      symbol,
      description,
      imageUrl,
      initialBuyEth,
      deadlineSeconds,
    } = req.body;

    if (!name || !symbol) {
      throw new AppError(400, 'name and symbol are required');
    }

    const steps: Array<{
      step: number;
      network: string;
      chainId: number;
      action: string;
      description: string;
      tx?: { to: string; data: string; value?: string };
      note?: string;
    }> = [];

    let stepNum = 1;

    // Step 1 (optional): Draw credit from vault on Sepolia
    if (vaultAddress) {
      const drawData = encodeFunctionData({
        abi: MerchantVaultABI,
        functionName: 'releaseTranche',
      });

      steps.push({
        step: stepNum++,
        network: 'base-sepolia',
        chainId: 84532,
        action: 'draw_credit',
        description: 'Draw from credit line (release next tranche)',
        tx: { to: vaultAddress, data: drawData },
      });
    }

    // Step 2: Upload metadata (handled server-side, returns URI)
    steps.push({
      step: stepNum++,
      network: 'off-chain',
      chainId: 0,
      action: 'upload_metadata',
      description: `Upload metadata via POST ${KICKSTART_API}/upload/metadata or POST /api/v1/kickstart/upload-metadata`,
      note: `Upload token metadata (name: ${name}, ticker: ${symbol}${description ? ', description: ' + description.slice(0, 50) : ''}) to get a metadata URI. Use the /kickstart/upload-metadata endpoint.`,
    });

    // Step 3: Create token on Kickstart (Base mainnet)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + (deadlineSeconds ?? 86400));
    const createData = encodeFunctionData({
      abi: KickstartFactoryABI,
      functionName: 'createToken',
      args: [name, symbol, 'METADATA_URI_FROM_STEP_2', deadline],
    });

    steps.push({
      step: stepNum++,
      network: 'base-mainnet',
      chainId: 8453,
      action: 'create_token',
      description: `Create ${name} ($${symbol}) on Kickstart`,
      tx: {
        to: KICKSTART_FACTORY,
        data: createData,
        value: initialBuyEth ? parseEther(String(initialBuyEth)).toString() : '0',
      },
      note: 'Replace METADATA_URI_FROM_STEP_2 in the tx data with the actual URI from the metadata upload step. Or use /kickstart/create-token with the URI to get the final tx.',
    });

    res.json({
      steps,
      totalSteps: steps.length,
      note: vaultAddress
        ? 'Step 1 draws credit on Base Sepolia. Step 2 uploads metadata off-chain. Step 3 creates the token on Base mainnet. Agent must have ETH on mainnet for step 3.'
        : 'Step 1 uploads metadata off-chain. Step 2 creates the token on Base mainnet. Agent must have ETH on mainnet.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/kickstart/tokens — list recently created tokens from factory
router.get('/tokens', async (req, res, next) => {
  try {
    const count = Number(req.query.count ?? 20);
    const start = Number(req.query.start ?? 0);

    const curves = await publicClientMainnet.readContract({
      address: KICKSTART_FACTORY,
      abi: KickstartFactoryABI,
      functionName: 'getCurves',
      args: [BigInt(start), BigInt(count)],
    }) as Address[];

    // Get token address for each curve
    const tokens = await Promise.all(
      curves.map(async (curveAddr) => {
        try {
          const tokenAddr = await publicClientMainnet.readContract({
            address: curveAddr,
            abi: BondingCurveABI,
            functionName: 'token',
          });
          return { curve: curveAddr, token: tokenAddr as Address };
        } catch {
          return { curve: curveAddr, token: null };
        }
      })
    );

    res.json({ tokens, total: tokens.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/kickstart/config — factory config info
router.get('/config', async (_req, res, next) => {
  try {
    const config = await publicClientMainnet.readContract({
      address: KICKSTART_FACTORY,
      abi: KickstartFactoryABI,
      functionName: 'getBondingCurveConfig',
    }) as [bigint, bigint, bigint];

    res.json({
      factory: KICKSTART_FACTORY,
      chainId: 8453,
      virtualEth: config[0].toString(),
      virtualToken: config[1].toString(),
      targetEth: config[2].toString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
