import { Router } from 'express';
import type { Address } from 'viem';
import { encodeFunctionData, parseEther } from 'viem';
import { env } from '../../config/env.js';
import { KickstartFactoryABI, BondingCurveABI, ERC20ABI } from '../../config/kickstart-abi.js';
import { formatUnits } from 'viem';
import { publicClientMainnet } from '../../chain/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import {
  KickstartUploadMetadataSchema, KickstartCreateTokenSchema,
  KickstartBuyTokenSchema, KickstartCreditAndLaunchSchema,
} from '../schemas.js';
import { addresses, MerchantVaultABI } from '../../config/contracts.js';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

const router = Router();

const KICKSTART_FACTORY = env.KICKSTART_FACTORY_ADDRESS as Address;
const KICKSTART_API = env.KICKSTART_API_URL;

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }

  if (isIP(ip) === 6) {
    const n = ip.toLowerCase();
    return (
      n === '::1' ||
      n === '::' ||
      n.startsWith('fc') ||
      n.startsWith('fd') ||
      n.startsWith('fe8') ||
      n.startsWith('fe9') ||
      n.startsWith('fea') ||
      n.startsWith('feb') ||
      n.startsWith('::ffff:127.') ||
      n.startsWith('::ffff:10.') ||
      n.startsWith('::ffff:192.168.') ||
      n.startsWith('::ffff:172.')
    );
  }

  return true;
}

async function validateExternalImageUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError(400, 'imageUrl must be a valid URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AppError(400, 'imageUrl must use http or https');
  }
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new AppError(400, 'imageUrl must use https in production');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    throw new AppError(400, 'imageUrl cannot target localhost');
  }

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new AppError(400, 'imageUrl cannot target private IP ranges');
    return parsed;
  }

  const dnsResults = await lookup(hostname, { all: true }).catch(() => {
    throw new AppError(400, 'imageUrl hostname lookup failed');
  });
  if (!dnsResults || dnsResults.length === 0) {
    throw new AppError(400, 'imageUrl hostname did not resolve');
  }
  for (const r of dnsResults) {
    if (isPrivateIp(r.address)) {
      throw new AppError(400, 'imageUrl resolves to private/internal IP');
    }
  }

  return parsed;
}

// POST /api/v1/kickstart/upload-metadata
// Proxy metadata upload to EasyA Kickstart API
router.post('/upload-metadata', validate(KickstartUploadMetadataSchema), async (req, res, next) => {
  try {
    const { name, ticker, description, imageUrl, imageBase64, imageMime, twitter, telegram, website } = req.body;

    // Append social links to description if provided
    let fullDescription = description;
    const socials: string[] = [];
    if (twitter)  socials.push(`Twitter: ${twitter}`);
    if (telegram) socials.push(`Telegram: ${telegram}`);
    if (website)  socials.push(`Website: ${website}`);
    if (socials.length) fullDescription = `${description}\n\n${socials.join('\n')}`;

    // Build form data for the Kickstart metadata API
    const formData = new FormData();
    formData.append('name', name);
    formData.append('ticker', ticker);
    formData.append('symbol', ticker);
    formData.append('description', fullDescription);

    // Support base64 image (from direct file upload), imageUrl, or default placeholder
    const effectiveImageUrl = imageUrl || 'https://placehold.co/400x400/1a1a1a/52FFA1/png?text=' + encodeURIComponent(ticker.slice(0, 4).toUpperCase());
    if (imageBase64) {
      const mime = imageMime || 'image/png';
      const ext = mime.split('/')[1] || 'png';
      const buffer = Buffer.from(imageBase64, 'base64');
      const blob = new Blob([buffer], { type: mime });
      formData.append('image', blob, `token-image.${ext}`);
    } else {
      const validatedImageUrl = await validateExternalImageUrl(effectiveImageUrl);
      let imageRes: Response;
      try {
        imageRes = await fetch(validatedImageUrl.toString(), {
          signal: AbortSignal.timeout(10_000),
          redirect: 'error',
        });
      } catch {
        throw new AppError(400, 'Failed to fetch image');
      }
      if (!imageRes.ok) {
        throw new AppError(400, `Failed to fetch image`);
      }
      const imageBlob = await imageRes.blob();
      const ext = validatedImageUrl.pathname.split('.').pop()?.split('?')[0] || 'png';
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
router.post('/create-token', validate(KickstartCreateTokenSchema), async (req, res, next) => {
  try {
    const { name, symbol, uri, deadlineSeconds, initialBuyEth } = req.body;

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
router.post('/buy-token', validate(KickstartBuyTokenSchema), async (req, res, next) => {
  try {
    const { curveAddress, ethAmount, minTokensOut } = req.body;

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
router.post('/credit-and-launch', validate(KickstartCreditAndLaunchSchema), async (req, res, next) => {
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

// In-memory cache for enriched tokens (30s TTL)
const enrichedCache = new Map<string, { data: unknown; ts: number }>();

// GET /api/v1/kickstart/tokens/enriched — list tokens with name, symbol, bonding curve progress
router.get('/tokens/enriched', async (req, res, next) => {
  try {
    const count = Number(req.query.count ?? 20);
    const start = Number(req.query.start ?? 0);
    const cacheKey = `${start}-${count}`;

    const cached = enrichedCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 30_000) {
      return res.json(cached.data);
    }

    const [curves, bondingConfig] = await Promise.all([
      publicClientMainnet.readContract({
        address: KICKSTART_FACTORY,
        abi: KickstartFactoryABI,
        functionName: 'getCurves',
        args: [BigInt(start), BigInt(count)],
      }) as Promise<Address[]>,
      publicClientMainnet.readContract({
        address: KICKSTART_FACTORY,
        abi: KickstartFactoryABI,
        functionName: 'getBondingCurveConfig',
      }) as Promise<[bigint, bigint, bigint]>,
    ]);

    const targetEth = bondingConfig[2];

    const tokens = await Promise.all(
      curves.map(async (curveAddr) => {
        try {
          const [tokenAddr, ethRaisedWei] = await Promise.all([
            publicClientMainnet.readContract({
              address: curveAddr,
              abi: BondingCurveABI,
              functionName: 'token',
            }) as Promise<Address>,
            publicClientMainnet.getBalance({ address: curveAddr }),
          ]);

          let name = 'Unknown';
          let symbol = '???';
          if (tokenAddr) {
            try {
              [name, symbol] = await Promise.all([
                publicClientMainnet.readContract({ address: tokenAddr, abi: ERC20ABI, functionName: 'name' }) as Promise<string>,
                publicClientMainnet.readContract({ address: tokenAddr, abi: ERC20ABI, functionName: 'symbol' }) as Promise<string>,
              ]);
            } catch { /* keep defaults */ }
          }

          const progressPct = targetEth > 0n
            ? Math.min(100, Number(ethRaisedWei * 10000n / targetEth) / 100)
            : 0;

          return {
            curve: curveAddr,
            token: tokenAddr ?? null,
            name,
            symbol,
            ethRaisedEth: parseFloat(formatUnits(ethRaisedWei, 18)).toFixed(4),
            progressPct: Math.round(progressPct * 10) / 10,
            graduated: progressPct >= 100,
          };
        } catch {
          return { curve: curveAddr, token: null, name: 'Unknown', symbol: '???', ethRaisedEth: '0.0000', progressPct: 0, graduated: false };
        }
      })
    );

    const graduatedCount = tokens.filter(t => t.graduated).length;
    const totalEthRaised = tokens.reduce((sum, t) => sum + parseFloat(t.ethRaisedEth), 0);

    const response = {
      tokens,
      total: tokens.length,
      stats: {
        totalTokens: tokens.length,
        graduatedCount,
        totalEthRaisedEth: totalEthRaised.toFixed(4),
      },
    };

    enrichedCache.set(cacheKey, { data: response, ts: Date.now() });
    setTimeout(() => enrichedCache.delete(cacheKey), 30_000);

    return res.json(response);
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
