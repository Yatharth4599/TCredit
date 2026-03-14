import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenAnalysis {
  token: string;
  analysis: {
    riskScore: number;
    summary: string;
    recommendation: 'Buy' | 'Hold' | 'Sell' | 'Avoid';
    metrics: Record<string, string | number>;
  };
  meta: {
    poweredBy: string;
    paidVia: string;
    paymentTx: string;
    creditStatus: string;
  };
}

export interface TrendingAnalysis {
  tokens: Array<{
    rank: number;
    address: string;
    name: string;
    riskScore: number;
    summary: string;
    recommendation: 'Buy' | 'Hold' | 'Sell' | 'Avoid';
  }>;
  meta: {
    poweredBy: string;
    paidVia: string;
    paymentTx: string;
    creditStatus: string;
  };
}

// ---------------------------------------------------------------------------
// Single token analysis
// ---------------------------------------------------------------------------

export async function analyzeToken(tokenAddress: string, paymentTx: string): Promise<TokenAnalysis> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `You are a Solana token analyst. Analyze the token at address: ${tokenAddress}

Provide a structured analysis:
1. Risk Score (1-10, where 1 = very safe, 10 = extremely risky)
2. Summary (2-3 sentences about this token/address)
3. Key Metrics (make reasonable assessments based on the address)
4. Recommendation (Buy / Hold / Sell / Avoid)

Be concise and direct. This is for an AI agent making decisions.

Respond with ONLY valid JSON in this exact shape:
{
  "riskScore": <number 1-10>,
  "summary": "<string>",
  "recommendation": "<Buy|Hold|Sell|Avoid>",
  "metrics": {
    "marketCapEstimate": "<string>",
    "liquidityLevel": "<Low|Medium|High>",
    "ageEstimate": "<string>",
    "holderConcentration": "<Low|Medium|High>"
  }
}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let parsed: TokenAnalysis['analysis'];
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    // Claude occasionally wraps JSON in markdown fences — strip them
    const clean = textBlock.text.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(clean);
  }

  return {
    token: tokenAddress,
    analysis: parsed,
    meta: {
      poweredBy: 'Krexa Research Agent',
      paidVia: 'x402 on Solana',
      paymentTx,
      creditStatus: 'Repaying via Krexa Revenue Router',
    },
  };
}

// ---------------------------------------------------------------------------
// Trending tokens
// ---------------------------------------------------------------------------

// Well-known Solana tokens used as stand-ins for "trending" in the demo.
// In production this would call Jupiter/Birdeye API.
const DEMO_TRENDING = [
  { address: 'So11111111111111111111111111111111111111112', name: 'Wrapped SOL' },
  { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USDC' },
  { address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', name: 'mSOL' },
  { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk' },
  { address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', name: 'JUP' },
];

export async function analyzeTrending(paymentTx: string): Promise<TrendingAnalysis> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content: `You are a Solana token analyst. Provide a brief analysis of these 5 trending Solana tokens:

${DEMO_TRENDING.map((t, i) => `${i + 1}. ${t.name} (${t.address})`).join('\n')}

For each token provide:
- riskScore (1-10)
- summary (1 sentence)
- recommendation (Buy / Hold / Sell / Avoid)

Respond with ONLY valid JSON — an array of 5 objects:
[
  {
    "rank": 1,
    "address": "<address>",
    "name": "<name>",
    "riskScore": <number>,
    "summary": "<string>",
    "recommendation": "<Buy|Hold|Sell|Avoid>"
  },
  ...
]`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let tokens: TrendingAnalysis['tokens'];
  try {
    tokens = JSON.parse(textBlock.text);
  } catch {
    const clean = textBlock.text.replace(/```json\n?|\n?```/g, '').trim();
    tokens = JSON.parse(clean);
  }

  return {
    tokens,
    meta: {
      poweredBy: 'Krexa Research Agent',
      paidVia: 'x402 on Solana',
      paymentTx,
      creditStatus: 'Repaying via Krexa Revenue Router',
    },
  };
}
