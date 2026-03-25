import { addresses } from './contracts.js';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Krexa API',
    version: '0.2.0',
    description:
      'Krexa — programmable AI agent credit on Solana. All monetary values are USDC base units (6 decimals). Solana endpoints accept/return base58-encoded public keys. Write endpoints return unsigned Solana transactions for client-side signing.',
    contact: { name: 'Krexa', url: 'https://github.com/Yatharth4599/TCredit' },
  },
  servers: [
    { url: '/api/v1', description: 'Canonical API (v1)' },
    { url: '/api', description: 'Backward-compatible' },
  ],
  tags: [
    { name: 'Health', description: 'Service health checks' },
    { name: 'Vaults', description: 'Merchant credit vaults' },
    { name: 'Merchants', description: 'Agent/merchant profiles and credit' },
    { name: 'Pools', description: 'Liquidity pools (Senior + General)' },
    { name: 'Investments', description: 'Investor portfolio, invest, claim, refund' },
    { name: 'Platform', description: 'TVL, config, indexer & keeper health' },
    { name: 'Oracle', description: 'Payment oracle (ECDSA webhook)' },
    { name: 'Payments', description: 'Payment history (event-indexed)' },
    { name: 'Admin', description: 'API keys and webhook management (requires API key)' },
    { name: 'Credit Bureau', description: 'Agent credit scores, reports, and history — the CIBIL moat. Score lookup is free (100 req/day); full reports and history require a paid-tier API key.' },
    { name: 'Agent Credit', description: 'Credit eligibility, extension, repayment, score breakdown, and legal e-signing for Solana agents.' },
    { name: 'Agent Wallets', description: 'Solana agent wallet creation, state, health, balance, and trades.' },
    { name: 'Vault (Solana)', description: 'On-chain vault stats, LP positions, collateral, and service health.' },
    { name: 'Oracle (Solana)', description: 'Oracle-signed credit transactions on Solana.' },
    { name: 'Score (Solana)', description: 'On-chain Krexit Score lookup and preview.' },
    { name: 'KYA', description: 'Know Your Agent verification — Basic (wallet signature) and Enhanced (Sumsub KYC).' },
    { name: 'Faucet', description: 'Devnet USDC faucet for testing (rate-limited).' },
    { name: 'x402', description: 'HTTP 402 Payment Required facilitator — register API resources, verify payments, and manage per-call pricing.' },
  ],
  paths: {
    // ── Health ──
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Service health check',
        description: 'Returns database, chain, and overall service status.',
        responses: {
          200: {
            description: 'Service is healthy or degraded',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
          503: { description: 'Service is down' },
        },
      },
    },

    // ── Vaults ──
    '/vaults': {
      get: {
        tags: ['Vaults'],
        summary: 'List all vaults',
        parameters: [
          { name: 'state', in: 'query', schema: { type: 'string', enum: ['fundraising', 'active', 'repaying', 'completed', 'defaulted', 'cancelled'] } },
          { name: 'agent', in: 'query', schema: { type: 'string' }, description: '0x agent address filter' },
        ],
        responses: {
          200: {
            description: 'List of vaults',
            content: { 'application/json': { schema: { type: 'object', properties: { vaults: { type: 'array', items: { $ref: '#/components/schemas/Vault' } }, total: { type: 'integer' } } } } },
          },
        },
      },
    },
    '/vaults/create': {
      post: {
        tags: ['Vaults'],
        summary: 'Build unsigned createVault transaction',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVaultRequest' } } },
        },
        responses: { 200: { description: 'Unsigned transaction', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },
    '/vaults/{address}': {
      get: {
        tags: ['Vaults'],
        summary: 'Vault detail',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Vault detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/VaultDetail' } } } } },
      },
    },
    '/vaults/{address}/investors': {
      get: {
        tags: ['Vaults'],
        summary: 'List investors with balances',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Investor list',
            content: { 'application/json': { schema: { type: 'object', properties: { investors: { type: 'array', items: { $ref: '#/components/schemas/Investor' } }, total: { type: 'integer' } } } } },
          },
        },
      },
    },
    '/vaults/{address}/waterfall': {
      get: {
        tags: ['Vaults'],
        summary: 'Waterfall distribution state',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Waterfall data', content: { 'application/json': { schema: { $ref: '#/components/schemas/WaterfallData' } } } } },
      },
    },
    '/vaults/{address}/milestones': {
      get: {
        tags: ['Vaults'],
        summary: 'Milestone status per tranche',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Milestones', content: { 'application/json': { schema: { type: 'object', properties: { milestones: { type: 'array', items: { $ref: '#/components/schemas/Milestone' } }, total: { type: 'integer' } } } } } } },
      },
    },
    '/vaults/{address}/tranches': {
      get: {
        tags: ['Vaults'],
        summary: 'Tranche release status',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Tranche data', content: { 'application/json': { schema: { $ref: '#/components/schemas/TrancheResponse' } } } } },
      },
    },
    '/vaults/{address}/repayments': {
      get: {
        tags: ['Vaults'],
        summary: 'Repayment history (indexed events)',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Repayment events', content: { 'application/json': { schema: { type: 'object', properties: { repayments: { type: 'array', items: { $ref: '#/components/schemas/VaultEvent' } }, total: { type: 'integer' } } } } } } },
      },
    },
    '/vaults/{address}/milestone/submit': {
      post: {
        tags: ['Vaults'],
        summary: 'Build unsigned submitMilestone tx',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['trancheIndex', 'evidenceHash'], properties: { trancheIndex: { type: 'integer' }, evidenceHash: { type: 'string', description: '0x-prefixed bytes32' } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },
    '/vaults/{address}/milestone/vote': {
      post: {
        tags: ['Vaults'],
        summary: 'Build unsigned voteMilestone tx',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['trancheIndex', 'approve'], properties: { trancheIndex: { type: 'integer' }, approve: { type: 'boolean' } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },

    // ── Merchants ──
    '/merchants/{address}': {
      get: {
        tags: ['Merchants'],
        summary: 'Merchant profile from chain',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Merchant profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/MerchantProfile' } } } } },
      },
    },
    '/merchants/{address}/vaults': {
      get: {
        tags: ['Merchants'],
        summary: 'Vaults belonging to this agent',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Agent vaults', content: { 'application/json': { schema: { type: 'object', properties: { vaults: { type: 'array', items: { $ref: '#/components/schemas/Vault' } }, total: { type: 'integer' } } } } } } },
      },
    },
    '/merchants/{address}/stats': {
      get: {
        tags: ['Merchants'],
        summary: 'Dashboard stats for a merchant',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Merchant stats', content: { 'application/json': { schema: { $ref: '#/components/schemas/MerchantStats' } } } } },
      },
    },
    '/merchants/{address}/repayments': {
      get: {
        tags: ['Merchants'],
        summary: 'Merchant repayment history',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Repayments (populated by indexer)', content: { 'application/json': { schema: { type: 'object', properties: { repayments: { type: 'array' }, total: { type: 'integer' } } } } } } },
      },
    },
    '/merchants/register': {
      post: {
        tags: ['Merchants'],
        summary: 'Build unsigned registerAgent tx',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['metadataURI'], properties: { metadataURI: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },
    '/merchants/{address}/credit-score': {
      post: {
        tags: ['Merchants'],
        summary: 'Build unsigned updateCreditScore tx (admin)',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['score'], properties: { score: { type: 'integer', minimum: 0, maximum: 1000 } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },

    // ── Pools ──
    '/pools': {
      get: {
        tags: ['Pools'],
        summary: 'List all liquidity pools',
        responses: { 200: { description: 'Pool list with summary', content: { 'application/json': { schema: { $ref: '#/components/schemas/PoolsResponse' } } } } },
      },
    },
    '/pools/{address}': {
      get: {
        tags: ['Pools'],
        summary: 'Single pool detail',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Pool data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Pool' } } } } },
      },
    },
    '/pools/{address}/allocation/{vault}': {
      get: {
        tags: ['Pools'],
        summary: 'Pool allocation to a vault',
        parameters: [
          { name: 'address', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'vault', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Allocation data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Allocation' } } } } },
      },
    },
    '/pools/deposit': {
      post: {
        tags: ['Pools'],
        summary: 'Build unsigned deposit tx',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['poolAddress', 'amount'], properties: { poolAddress: { type: 'string' }, amount: { type: 'string', description: 'USDC wei amount' } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },
    '/pools/withdraw': {
      post: {
        tags: ['Pools'],
        summary: 'Build unsigned withdraw tx',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['poolAddress', 'amount'], properties: { poolAddress: { type: 'string' }, amount: { type: 'string', description: 'USDC wei amount' } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },
    '/pools/allocate': {
      post: {
        tags: ['Pools'],
        summary: 'Build unsigned allocateToVault tx (admin)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['poolAddress', 'vaultAddress', 'amount'], properties: { poolAddress: { type: 'string' }, vaultAddress: { type: 'string' }, amount: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },

    // ── Investments ──
    '/portfolio/{address}': {
      get: {
        tags: ['Investments'],
        summary: 'All investments for a wallet',
        parameters: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Portfolio', content: { 'application/json': { schema: { $ref: '#/components/schemas/PortfolioResponse' } } } } },
      },
    },
    '/invest': {
      post: {
        tags: ['Investments'],
        summary: 'Build unsigned invest tx (approve USDC first)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['vaultAddress', 'amount'], properties: { vaultAddress: { type: 'string' }, amount: { type: 'string', description: 'USDC wei amount' } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },
    '/claim': {
      post: {
        tags: ['Investments'],
        summary: 'Build unsigned claimReturns tx',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['vaultAddress'], properties: { vaultAddress: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },
    '/refund': {
      post: {
        tags: ['Investments'],
        summary: 'Build unsigned claimRefund tx (cancelled vaults)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['vaultAddress'], properties: { vaultAddress: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Unsigned tx', content: { 'application/json': { schema: { $ref: '#/components/schemas/UnsignedTx' } } } } },
      },
    },

    // ── Platform ──
    '/platform/stats': {
      get: {
        tags: ['Platform'],
        summary: 'Live platform statistics',
        responses: { 200: { description: 'Platform stats', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformStats' } } } } },
      },
    },
    '/platform/config': {
      get: {
        tags: ['Platform'],
        summary: 'Platform configuration and contract addresses',
        responses: { 200: { description: 'Config', content: { 'application/json': { schema: { $ref: '#/components/schemas/PlatformConfig' } } } } },
      },
    },
    '/platform/indexer': {
      get: {
        tags: ['Platform'],
        summary: 'Event indexer health and sync status',
        responses: { 200: { description: 'Indexer health' } },
      },
    },
    '/platform/keeper': {
      get: {
        tags: ['Platform'],
        summary: 'Keeper service health',
        responses: { 200: { description: 'Keeper health' } },
      },
    },

    // ── Oracle ──
    '/oracle/payment': {
      post: {
        tags: ['Oracle'],
        summary: 'Submit payment for oracle processing',
        description: 'The oracle signs the payment with ECDSA and submits it to the PaymentRouter contract.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OraclePaymentRequest' } } },
        },
        responses: {
          200: { description: 'Payment confirmed on-chain' },
          202: { description: 'Payment submitted, awaiting confirmation' },
        },
      },
    },
    '/oracle/health': {
      get: {
        tags: ['Oracle'],
        summary: 'Oracle service status',
        responses: { 200: { description: 'Oracle health' }, 503: { description: 'Oracle down' } },
      },
    },
    '/oracle/payments': {
      get: {
        tags: ['Oracle'],
        summary: 'List oracle-processed payments',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'submitted', 'confirmed', 'failed'] } },
          { name: 'vault', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
        ],
        responses: { 200: { description: 'Oracle payments', content: { 'application/json': { schema: { type: 'object', properties: { payments: { type: 'array', items: { $ref: '#/components/schemas/OraclePayment' } }, total: { type: 'integer' } } } } } } },
      },
    },

    // ── Payments ──
    '/payments/recent': {
      get: {
        tags: ['Payments'],
        summary: 'Recent payment events (indexed)',
        responses: { 200: { description: 'Payments', content: { 'application/json': { schema: { type: 'object', properties: { payments: { type: 'array' }, total: { type: 'integer' } } } } } } },
      },
    },
    '/payments/{paymentId}/waterfall': {
      get: {
        tags: ['Payments'],
        summary: 'Payment waterfall distribution',
        parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Waterfall data' } },
      },
    },

    // ── Credit Bureau ──
    '/credit-bureau/{agent}/score': {
      get: {
        tags: ['Credit Bureau'],
        summary: 'Agent credit score lookup (free tier)',
        description: 'Returns the agent\'s current credit score, level, and attestation hash. No API key required. Rate-limited to 100 req/day for anonymous requests.',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana agent public key' }],
        responses: { 200: { description: 'Credit score', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditScore' } } } } },
      },
    },
    '/credit-bureau/{agent}/report': {
      get: {
        tags: ['Credit Bureau'],
        summary: 'Full credit report (paid tier)',
        description: 'Returns comprehensive credit report including score components, payment history, health history, risk flags, and 30-day score trend. Requires paid-tier API key.',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana agent public key' }],
        responses: {
          200: { description: 'Full credit report', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditReport' } } } },
          401: { description: 'API key required' },
          403: { description: 'Paid-tier API key required' },
        },
      },
    },
    '/credit-bureau/{agent}/history': {
      get: {
        tags: ['Credit Bureau'],
        summary: 'Credit event history (paid tier)',
        description: 'Returns paginated timeline of credit events: borrowings, repayments, liquidations, trades, score changes, and legal agreements. Requires paid-tier API key.',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'agent', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana agent public key' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
        ],
        responses: {
          200: { description: 'Credit history', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditHistory' } } } },
          401: { description: 'API key required' },
          403: { description: 'Paid-tier API key required' },
        },
      },
    },

    // ── Agent Credit (Solana) ──
    '/solana/credit/{agent}/score-breakdown': {
      get: {
        tags: ['Agent Credit'],
        summary: '5-component score breakdown',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Score with component breakdown', content: { 'application/json': { schema: { $ref: '#/components/schemas/ScoreBreakdown' } } } } },
      },
    },
    '/solana/credit/{agent}/sign-agreement': {
      post: {
        tags: ['Agent Credit'],
        summary: 'Initiate legal agreement for L3-L4 credit',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['creditLevel'], properties: { creditLevel: { type: 'integer', enum: [3, 4] } } } } } },
        responses: { 200: { description: 'Agreement initiated with hash for on-chain signing' } },
      },
    },
    '/solana/credit/{agent}/agreement-status': {
      get: {
        tags: ['Agent Credit'],
        summary: 'Check legal agreement signing status',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Agreement status' } },
      },
    },

    // ── Agent Credit (Solana) — additional endpoints ──
    '/solana/credit/{agent}/eligibility': {
      get: {
        tags: ['Agent Credit'],
        summary: 'Check credit eligibility',
        description: 'Returns whether the agent meets requirements for credit at their current level: KYA tier, score threshold, and active wallet.',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana agent public key' }],
        responses: {
          200: { description: 'Eligibility result', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditEligibility' } } } },
          404: { description: 'Agent not found' },
        },
      },
    },
    '/solana/credit/{agent}/line': {
      get: {
        tags: ['Agent Credit'],
        summary: 'Current credit line state',
        description: 'Returns the on-chain credit line: limit, drawn, accrued interest, rate, and origination date.',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana agent public key' }],
        responses: {
          200: { description: 'Credit line details', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolanaCreditLine' } } } },
          404: { description: 'No credit line found' },
        },
      },
    },
    '/solana/credit/{agent}/activity': {
      get: {
        tags: ['Agent Credit'],
        summary: 'Recent credit activity',
        description: 'Returns paginated score snapshots, health snapshots, and recent trades for the agent.',
        parameters: [
          { name: 'agent', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana agent public key' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: { description: 'Activity feed', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditActivity' } } } },
        },
      },
    },
    '/solana/credit/{agent}/request': {
      post: {
        tags: ['Agent Credit'],
        summary: 'Build unsigned request_credit transaction',
        description: 'Builds a Solana transaction to request credit. The oracle co-signs the transaction. Requires eligible agent with sufficient score and KYA.',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['ownerPubkey', 'amount'], properties: { ownerPubkey: { type: 'string', description: 'Owner wallet public key' }, amount: { type: 'string', description: 'USDC amount in base units (6 decimals)' } } } } },
        },
        responses: { 200: { description: 'Unsigned Solana transaction (base64)', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolanaUnsignedTx' } } } } },
      },
    },
    '/solana/credit/{agent}/repay': {
      post: {
        tags: ['Agent Credit'],
        summary: 'Build unsigned repay transaction',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['callerPubkey', 'amount'], properties: { callerPubkey: { type: 'string', description: 'Wallet paying the repayment' }, amount: { type: 'string', description: 'USDC amount in base units' } } } } },
        },
        responses: { 200: { description: 'Unsigned Solana transaction (base64)', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolanaUnsignedTx' } } } } },
      },
    },
    '/solana/credit/{agent}/confirm-agreement': {
      post: {
        tags: ['Agent Credit'],
        summary: 'Confirm legal agreement after on-chain signing',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['txSignature'], properties: { txSignature: { type: 'string', description: 'On-chain transaction signature' } } } } },
        },
        responses: { 200: { description: 'Agreement confirmed' } },
      },
    },

    // ── Agent Wallets (Solana) ──
    '/solana/wallets': {
      get: {
        tags: ['Agent Wallets'],
        summary: 'List all agent wallets',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } }],
        responses: { 200: { description: 'Wallet list', content: { 'application/json': { schema: { type: 'object', properties: { wallets: { type: 'array', items: { $ref: '#/components/schemas/AgentWalletSummary' } }, total: { type: 'integer' } } } } } } },
      },
    },
    '/solana/wallets/create': {
      post: {
        tags: ['Agent Wallets'],
        summary: 'Build unsigned create_wallet transaction',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['agentPubkey', 'ownerPubkey'], properties: { agentPubkey: { type: 'string' }, ownerPubkey: { type: 'string' }, dailySpendLimit: { type: 'string', default: '100000000', description: 'USDC base units (default $100)' } } } } },
        },
        responses: { 200: { description: 'Unsigned Solana transaction', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolanaUnsignedTx' } } } } },
      },
    },
    '/solana/wallets/{agent}': {
      get: {
        tags: ['Agent Wallets'],
        summary: 'Full wallet state',
        description: 'Returns on-chain wallet state including credit drawn, debt, collateral, daily spend, and health factor.',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Wallet state', content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentWalletState' } } } },
          404: { description: 'Wallet not found' },
        },
      },
    },
    '/solana/wallets/{agent}/health': {
      get: {
        tags: ['Agent Wallets'],
        summary: 'Current health factor',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Health status', content: { 'application/json': { schema: { $ref: '#/components/schemas/WalletHealth' } } } } },
      },
    },
    '/solana/wallets/{agent}/balance': {
      get: {
        tags: ['Agent Wallets'],
        summary: 'USDC balance',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Balance', content: { 'application/json': { schema: { type: 'object', properties: { agent: { type: 'string' }, balance: { type: 'string', description: 'USDC base units' } } } } } } },
      },
    },
    '/solana/wallets/{agent}/trades': {
      get: {
        tags: ['Agent Wallets'],
        summary: 'Recent trades',
        parameters: [
          { name: 'agent', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { 200: { description: 'Trade list', content: { 'application/json': { schema: { type: 'object', properties: { trades: { type: 'array', items: { $ref: '#/components/schemas/AgentTrade' } }, total: { type: 'integer' } } } } } } },
      },
    },
    '/solana/wallets/{agent}/propose-transfer': {
      post: {
        tags: ['Agent Wallets'],
        summary: 'Propose wallet ownership transfer',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['currentOwner', 'newOwner'], properties: { currentOwner: { type: 'string' }, newOwner: { type: 'string' } } } } } },
        responses: { 200: { description: 'Unsigned transfer proposal transaction', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolanaUnsignedTx' } } } } },
      },
    },
    '/solana/wallets/{agent}/accept-transfer': {
      post: {
        tags: ['Agent Wallets'],
        summary: 'Accept wallet ownership transfer',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['newOwner'], properties: { newOwner: { type: 'string' } } } } } },
        responses: { 200: { description: 'Unsigned accept transaction', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolanaUnsignedTx' } } } } },
      },
    },
    '/solana/wallets/{agent}/cancel-transfer': {
      post: {
        tags: ['Agent Wallets'],
        summary: 'Cancel wallet ownership transfer',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['owner'], properties: { owner: { type: 'string' } } } } } },
        responses: { 200: { description: 'Unsigned cancel transaction', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolanaUnsignedTx' } } } } },
      },
    },

    // ── Vault (Solana) ──
    '/solana/vault/stats': {
      get: {
        tags: ['Vault (Solana)'],
        summary: 'Vault health and utilization',
        description: 'Returns on-chain vault stats: total deposits, deployed, utilization, tranche breakdown, and insurance balance.',
        responses: { 200: { description: 'Vault stats', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolanaVaultStats' } } } } },
      },
    },
    '/solana/vault/lp/{depositor}': {
      get: {
        tags: ['Vault (Solana)'],
        summary: 'LP position for a depositor',
        parameters: [{ name: 'depositor', in: 'path', required: true, schema: { type: 'string' }, description: 'Depositor public key' }],
        responses: { 200: { description: 'LP positions across tranches', content: { 'application/json': { schema: { $ref: '#/components/schemas/LPPositions' } } } } },
      },
    },
    '/solana/vault/collateral/{agent}': {
      get: {
        tags: ['Vault (Solana)'],
        summary: 'Collateral position for an agent',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Collateral details', content: { 'application/json': { schema: { type: 'object', properties: { agent: { type: 'string' }, shares: { type: 'string' }, depositAmount: { type: 'string' }, depositedAt: { type: 'integer' } } } } } } },
      },
    },
    '/solana/vault/health': {
      get: {
        tags: ['Vault (Solana)'],
        summary: 'Indexer and keeper service health',
        responses: { 200: { description: 'Service health', content: { 'application/json': { schema: { type: 'object', properties: { indexer: { type: 'object' }, keeper: { type: 'object' } } } } } } },
      },
    },

    // ── Oracle (Solana) ──
    '/solana/oracle/sign-credit': {
      post: {
        tags: ['Oracle (Solana)'],
        summary: 'Build oracle-signed credit request transaction',
        description: 'The oracle validates the credit request and co-signs the Solana transaction. Returns a partially-signed transaction for the user to complete.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['agentPubkey', 'ownerPubkey', 'amount'], properties: { agentPubkey: { type: 'string' }, ownerPubkey: { type: 'string' }, amount: { type: 'string', description: 'USDC base units' } } } } },
        },
        responses: {
          200: { description: 'Oracle-signed transaction', content: { 'application/json': { schema: { $ref: '#/components/schemas/SolanaUnsignedTx' } } } },
          400: { description: 'Agent not eligible' },
        },
      },
    },

    // ── Score (Solana) ──
    '/solana/score/{agent}': {
      get: {
        tags: ['Score (Solana)'],
        summary: 'Full Krexit Score',
        description: 'Returns the on-chain 5-component score. If the agent has no on-chain score, returns a preview based on wallet activity.',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana agent public key' }],
        responses: { 200: { description: 'Krexit Score', content: { 'application/json': { schema: { $ref: '#/components/schemas/KrexitScoreResponse' } } } } },
      },
    },

    // ── KYA ──
    '/solana/kya/{agent}/basic': {
      post: {
        tags: ['KYA'],
        summary: 'Basic KYA verification (Tier 1)',
        description: 'Automated verification via wallet message signing. Proves ownership of the agent wallet.',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['ownerPubkey', 'ownerSignature'], properties: { ownerPubkey: { type: 'string', description: 'Owner wallet that signed the message' }, ownerSignature: { type: 'string', description: 'Base64-encoded signature' } } } } },
        },
        responses: {
          200: { description: 'KYA result', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['approved', 'pending'] }, kyaTier: { type: 'integer' } } } } } },
          400: { description: 'Invalid signature or agent' },
        },
      },
    },
    '/solana/kya/{agent}/enhanced': {
      post: {
        tags: ['KYA'],
        summary: 'Enhanced KYA verification (Tier 2)',
        description: 'Initiates Sumsub KYC flow. Returns a verification URL for the user to complete identity checks.',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['ownerPubkey'], properties: { ownerPubkey: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Verification URL', content: { 'application/json': { schema: { type: 'object', properties: { verificationUrl: { type: 'string', format: 'uri' }, status: { type: 'string' } } } } } } },
      },
    },
    '/solana/kya/{agent}/status': {
      get: {
        tags: ['KYA'],
        summary: 'Current KYA verification status',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'KYA status', content: { 'application/json': { schema: { type: 'object', properties: { agent: { type: 'string' }, kyaTier: { type: 'integer' }, tierName: { type: 'string', enum: ['None', 'Basic', 'Enhanced', 'Institutional'] }, verifiedAt: { type: 'string', format: 'date-time', nullable: true } } } } } } },
      },
    },

    // ── Faucet ──
    '/solana/faucet/usdc': {
      post: {
        tags: ['Faucet'],
        summary: 'Mint test USDC (devnet only)',
        description: 'Airdrops test USDC to the specified wallet. Rate-limited to 1 request per 24 hours per wallet.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['recipient'], properties: { recipient: { type: 'string', description: 'Solana wallet public key' }, amount: { type: 'integer', default: 1000, description: 'Amount in USDC (human units, default 1000)' } } } } },
        },
        responses: {
          200: { description: 'Faucet success', content: { 'application/json': { schema: { type: 'object', properties: { txSignature: { type: 'string' }, amount: { type: 'string' } } } } } },
          429: { description: 'Rate limited — try again after 24h' },
        },
      },
    },

    // ── x402 Payment Facilitator ──
    '/x402/register-resource': {
      post: {
        tags: ['x402'],
        summary: 'Register API resource with per-call pricing',
        description: 'Register a URL with USDC-denominated pricing. Returns an unsigned transaction to submit on-chain. After submission, use `/x402/resource-key` to derive the storage key.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['url', 'pricePerCallUsdc'], properties: { url: { type: 'string', description: 'The API endpoint URL to monetize' }, pricePerCallUsdc: { type: 'string', description: 'Price per call in USDC (e.g. "0.01")' } } } } },
        },
        responses: { 200: { description: 'Registration tx', content: { 'application/json': { schema: { type: 'object', properties: { rawResourceHash: { type: 'string' }, unsignedTx: { $ref: '#/components/schemas/UnsignedTx' }, description: { type: 'string' } } } } } } },
      },
    },
    '/x402/verify': {
      post: {
        tags: ['x402'],
        summary: 'Verify a payment receipt',
        description: 'Verify that a payment transaction was executed correctly for a given resource. Use this to gate access to paid API endpoints.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['resourceHash', 'txHash'], properties: { resourceHash: { type: 'string', description: 'Resource hash from registration' }, txHash: { type: 'string', description: 'On-chain transaction hash' } } } } },
        },
        responses: { 200: { description: 'Verification result', content: { 'application/json': { schema: { type: 'object', properties: { valid: { type: 'boolean' }, payer: { type: 'string' }, amount: { type: 'string' }, resource: { type: 'string' } } } } } } },
      },
    },
    '/x402/resource/{key}': {
      get: {
        tags: ['x402'],
        summary: 'Get resource by storage key',
        description: 'Look up a registered resource by its on-chain storage key (derived from rawResourceHash + ownerAddress).',
        parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' }, description: 'keccak256(abi.encode(rawResourceHash, ownerAddress))' }],
        responses: { 200: { description: 'Resource details', content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' }, pricePerCall: { type: 'string' }, owner: { type: 'string' }, facilitatorFeeBps: { type: 'integer' }, resourceKey: { type: 'string' } } } } } } },
      },
    },
    '/x402/resource-key/{rawHash}/{owner}': {
      get: {
        tags: ['x402'],
        summary: 'Derive storage key from raw hash + owner',
        description: 'Computes the on-chain storage key for a resource given the raw hash and owner address.',
        parameters: [
          { name: 'rawHash', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'owner', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Derived key', content: { 'application/json': { schema: { type: 'object', properties: { rawHash: { type: 'string' }, owner: { type: 'string' }, resourceKey: { type: 'string' } } } } } } },
      },
    },

    // ── Credit Bureau — simple check ──
    '/credit-bureau/{agent}/check': {
      get: {
        tags: ['Credit Bureau'],
        summary: 'Quick credit check (pass/fail)',
        description: 'Simple pass/fail credit check returning score tier, eligibility, and max credit. No API key required. Designed for quick integration by third-party services.',
        parameters: [{ name: 'agent', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana agent public key' }],
        responses: {
          200: { description: 'Credit check result', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditCheck' } } } },
        },
      },
    },

    // ── Admin: API Keys ──
    '/admin/keys': {
      get: {
        tags: ['Admin'], summary: 'List API keys', security: [{ ApiKeyAuth: [] }],
        responses: { 200: { description: 'API keys list', content: { 'application/json': { schema: { type: 'object', properties: { keys: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } }, total: { type: 'integer' } } } } } } },
      },
      post: {
        tags: ['Admin'], summary: 'Create API key', security: [{ ApiKeyAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, rateLimit: { type: 'integer', default: 100 } } } } } },
        responses: { 201: { description: 'Created API key (includes secret)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiKey' } } } } },
      },
    },
    '/admin/keys/{id}': {
      patch: {
        tags: ['Admin'], summary: 'Update API key', security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, rateLimit: { type: 'integer' }, active: { type: 'boolean' } } } } } },
        responses: { 200: { description: 'Updated key' } },
      },
      delete: {
        tags: ['Admin'], summary: 'Deactivate API key', security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Key deactivated' } },
      },
    },

    // ── Admin: Webhooks ──
    '/admin/webhooks': {
      get: {
        tags: ['Admin'], summary: 'List webhook endpoints', security: [{ ApiKeyAuth: [] }],
        responses: { 200: { description: 'Webhook endpoints', content: { 'application/json': { schema: { type: 'object', properties: { endpoints: { type: 'array', items: { $ref: '#/components/schemas/WebhookEndpoint' } }, total: { type: 'integer' } } } } } } },
      },
      post: {
        tags: ['Admin'], summary: 'Create webhook endpoint', security: [{ ApiKeyAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['url', 'events'], properties: { url: { type: 'string', format: 'uri' }, events: { type: 'array', items: { type: 'string' }, example: ['VaultCreated', 'RepaymentProcessed', 'Invested'] } } } } } },
        responses: { 201: { description: 'Created endpoint (includes secret — only shown once)', content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookEndpoint' } } } } },
      },
    },
    '/admin/webhooks/{id}': {
      patch: {
        tags: ['Admin'], summary: 'Update webhook endpoint', security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string', format: 'uri' }, events: { type: 'array', items: { type: 'string' } }, active: { type: 'boolean' } } } } } },
        responses: { 200: { description: 'Updated endpoint' } },
      },
      delete: {
        tags: ['Admin'], summary: 'Deactivate webhook endpoint', security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Endpoint deactivated' } },
      },
    },
    '/admin/webhooks/{id}/deliveries': {
      get: {
        tags: ['Admin'], summary: 'List deliveries for webhook endpoint', security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Delivery history', content: { 'application/json': { schema: { type: 'object', properties: { deliveries: { type: 'array', items: { $ref: '#/components/schemas/WebhookDelivery' } }, total: { type: 'integer' } } } } } } },
      },
    },
  },

  components: {
    schemas: {
      UnsignedTx: {
        type: 'object',
        required: ['to', 'data'],
        properties: {
          to: { type: 'string', description: 'Contract/program address' },
          data: { type: 'string', description: 'Encoded transaction data' },
          description: { type: 'string' },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
          timestamp: { type: 'string', format: 'date-time' },
          version: { type: 'string' },
          database: { type: 'boolean' },
          chain: { type: 'boolean' },
          chainId: { type: 'integer' },
          latestBlock: { type: 'integer' },
        },
      },
      Vault: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          agent: { type: 'string' },
          state: { type: 'string', enum: ['fundraising', 'active', 'repaying', 'completed', 'defaulted', 'cancelled'] },
          targetAmount: { type: 'string', description: 'USDC wei' },
          totalRaised: { type: 'string', description: 'USDC wei' },
          totalRepaid: { type: 'string', description: 'USDC wei' },
          totalToRepay: { type: 'string', description: 'USDC wei' },
          interestRate: { type: 'number', description: 'Annual percentage' },
          durationMonths: { type: 'number' },
          numTranches: { type: 'integer' },
          tranchesReleased: { type: 'integer' },
          investorCount: { type: 'integer' },
          percentFunded: { type: 'number' },
        },
      },
      VaultDetail: {
        allOf: [
          { $ref: '#/components/schemas/Vault' },
          { type: 'object', properties: { waterfall: { $ref: '#/components/schemas/WaterfallData' } } },
        ],
      },
      WaterfallData: {
        type: 'object',
        properties: {
          seniorFunded: { type: 'string' },
          poolFunded: { type: 'string' },
          userFunded: { type: 'string' },
          seniorRepaid: { type: 'string' },
          poolRepaid: { type: 'string' },
          communityRepaid: { type: 'string' },
        },
      },
      Investor: {
        type: 'object',
        properties: {
          investor: { type: 'string' },
          balance: { type: 'string', description: 'USDC wei' },
          claimable: { type: 'string', description: 'USDC wei' },
        },
      },
      Milestone: {
        type: 'object',
        properties: {
          trancheIndex: { type: 'integer' },
          status: { type: 'string', enum: ['pending', 'submitted', 'approved', 'rejected'] },
          approvalCount: { type: 'integer' },
          submittedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      TrancheResponse: {
        type: 'object',
        properties: {
          numTranches: { type: 'integer' },
          tranchesReleased: { type: 'integer' },
          tranches: { type: 'array', items: { type: 'object', properties: { index: { type: 'integer' }, released: { type: 'boolean' } } } },
        },
      },
      VaultEvent: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          eventType: { type: 'string' },
          data: { type: 'object' },
          blockNumber: { type: 'string' },
          txHash: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      CreateVaultRequest: {
        type: 'object',
        required: ['agent', 'targetAmount'],
        properties: {
          agent: { type: 'string', description: '0x agent address' },
          targetAmount: { type: 'string', description: 'USDC wei' },
          interestRateBps: { type: 'integer', default: 1200, description: 'BPS (1200 = 12%)' },
          durationSeconds: { type: 'integer', default: 15552000, description: 'Seconds (180 days default)' },
          numTranches: { type: 'integer', default: 3 },
          repaymentRateBps: { type: 'integer', default: 2000 },
          minPaymentInterval: { type: 'integer', default: 86400 },
          maxSinglePayment: { type: 'integer', default: 0 },
          lateFeeBps: { type: 'integer', default: 100 },
          gracePeriodSeconds: { type: 'integer', default: 604800 },
          fundraisingDeadline: { type: 'integer', description: 'Unix timestamp' },
        },
      },
      MerchantProfile: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          metadataURI: { type: 'string' },
          registeredAt: { type: 'string', format: 'date-time' },
          totalPaymentsReceived: { type: 'string' },
          totalPaymentsSent: { type: 'string' },
          hasActiveCreditLine: { type: 'boolean' },
          vault: { type: 'string' },
          active: { type: 'boolean' },
          creditTier: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          creditTierNum: { type: 'integer' },
          creditValid: { type: 'boolean' },
        },
      },
      MerchantStats: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          creditTier: { type: 'string' },
          creditRating: { type: 'string' },
          creditValid: { type: 'boolean' },
          activeLoanCount: { type: 'integer' },
          totalVaults: { type: 'integer' },
          totalBorrowed: { type: 'string' },
          totalRepaid: { type: 'string' },
          totalPaymentsReceived: { type: 'string' },
          totalPaymentsSent: { type: 'string' },
          hasActiveCreditLine: { type: 'boolean' },
        },
      },
      Pool: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          name: { type: 'string' },
          isAlpha: { type: 'boolean' },
          totalDeposits: { type: 'string' },
          totalAllocated: { type: 'string' },
          availableBalance: { type: 'string' },
          utilizationPct: { type: 'number' },
        },
      },
      PoolsResponse: {
        type: 'object',
        properties: {
          pools: { type: 'array', items: { $ref: '#/components/schemas/Pool' } },
          total: { type: 'integer' },
          summary: { type: 'object', properties: { totalDeposits: { type: 'string' }, totalAllocated: { type: 'string' }, totalAvailable: { type: 'string' } } },
        },
      },
      Allocation: {
        type: 'object',
        properties: {
          amount: { type: 'string' },
          returnedAmount: { type: 'string' },
          allocatedAt: { type: 'string', format: 'date-time', nullable: true },
          active: { type: 'boolean' },
        },
      },
      PortfolioResponse: {
        type: 'object',
        properties: {
          investments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                vaultAddress: { type: 'string' },
                agent: { type: 'string' },
                state: { type: 'string' },
                amountInvested: { type: 'string' },
                claimable: { type: 'string' },
                interestRate: { type: 'number' },
                durationMonths: { type: 'number' },
              },
            },
          },
          total: { type: 'integer' },
          summary: { type: 'object', properties: { totalInvested: { type: 'string' }, totalClaimable: { type: 'string' } } },
        },
      },
      PlatformStats: {
        type: 'object',
        properties: {
          totalVaults: { type: 'integer' },
          activeVaults: { type: 'integer' },
          tvl: { type: 'string' },
          totalRepaid: { type: 'string' },
          poolLiquidity: { type: 'string' },
        },
      },
      PlatformConfig: {
        type: 'object',
        properties: {
          platformFeeBps: { type: 'integer' },
          maxFeeBps: { type: 'integer' },
          minDurationSeconds: { type: 'integer' },
          maxDurationSeconds: { type: 'integer' },
          minInterestRateBps: { type: 'integer' },
          maxInterestRateBps: { type: 'integer' },
          chainId: { type: 'integer' },
          contracts: {
            type: 'object',
            properties: {
              agentRegistry: { type: 'string' },
              paymentRouter: { type: 'string' },
              vaultFactory: { type: 'string' },
              seniorPool: { type: 'string' },
              generalPool: { type: 'string' },
              milestoneRegistry: { type: 'string' },
            },
          },
        },
      },
      OraclePaymentRequest: {
        type: 'object',
        required: ['from', 'to', 'amount'],
        properties: {
          from: { type: 'string', description: '0x sender address' },
          to: { type: 'string', description: '0x receiver address' },
          amount: { type: 'string', description: 'USDC wei amount' },
          paymentId: { type: 'string', description: '0x optional payment ID' },
        },
      },
      OraclePayment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          vault: { type: 'string' },
          amount: { type: 'string' },
          nonce: { type: 'string' },
          deadline: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'submitted', 'confirmed', 'failed'] },
          txHash: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreditScore: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          score: { type: 'integer', minimum: 200, maximum: 850 },
          level: { type: 'integer', minimum: 0, maximum: 4 },
          lastUpdated: { type: 'string', format: 'date-time', nullable: true },
          isExpired: { type: 'boolean' },
          attestationHash: { type: 'string', nullable: true, description: 'SHA256 attestation hash — verifiable on-chain' },
        },
      },
      CreditReport: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          score: { type: 'integer' },
          level: { type: 'integer' },
          components: { type: 'object', description: '5-component breakdown: repayment, profit, behavior, usage, age (0-100 each)', nullable: true },
          activeCreditLine: { type: 'object', nullable: true },
          wallet: { type: 'object', nullable: true },
          paymentHistory: { type: 'object', properties: { totalBorrowed: { type: 'string' }, totalRepaid: { type: 'string' }, liquidationCount: { type: 'integer' }, repaymentRate: { type: 'number' } } },
          healthHistory: { type: 'array', items: { type: 'object', properties: { healthFactorBps: { type: 'integer' }, snapshotAt: { type: 'string', format: 'date-time' } } } },
          riskFlags: { type: 'array', items: { type: 'string' }, description: 'AGENT_DEACTIVATED, WALLET_FROZEN, LIQUIDATION_IN_PROGRESS, LOW_HEALTH_FACTOR, HAS_LIQUIDATION_HISTORY, STALE_SCORE' },
          scoreHistory30d: { type: 'array', items: { type: 'object', properties: { score: { type: 'integer' }, level: { type: 'integer' }, snapshotAt: { type: 'string', format: 'date-time' } } } },
          legalAgreementSigned: { type: 'boolean' },
          lastUpdated: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      CreditHistory: {
        type: 'object',
        properties: {
          events: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' }, details: { type: 'object' } } } },
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
        },
      },
      ScoreBreakdown: {
        type: 'object',
        properties: {
          agentPubkey: { type: 'string' },
          score: { type: 'integer' },
          components: { type: 'object', properties: { repayment: { type: 'number' }, profit: { type: 'number' }, behavior: { type: 'number' }, usage: { type: 'number' }, age: { type: 'number' } }, nullable: true },
          level: { type: 'integer' },
          nextLevelScore: { type: 'integer', nullable: true },
          pointsToNextLevel: { type: 'integer', nullable: true },
          attestationHash: { type: 'string', nullable: true },
          lastUpdated: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          key: { type: 'string', description: 'tck_ prefixed API key (shown only on creation)' },
          name: { type: 'string' },
          tier: { type: 'string', enum: ['free', 'paid'], description: 'API key tier — free: score lookup (100/day), paid: full reports (10K/day)' },
          rateLimit: { type: 'integer' },
          active: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      WebhookEndpoint: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string', format: 'uri' },
          secret: { type: 'string', description: 'whsec_ prefixed HMAC secret (shown only on creation)' },
          events: { type: 'array', items: { type: 'string' }, example: ['VaultCreated', 'Invested', 'RepaymentProcessed'] },
          active: { type: 'boolean' },
          deliveryCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // ── Solana-specific schemas ──
      SolanaUnsignedTx: {
        type: 'object',
        properties: {
          transaction: { type: 'string', description: 'Base64-encoded unsigned Solana transaction' },
          message: { type: 'string', description: 'Human-readable description' },
        },
      },
      CreditEligibility: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          eligible: { type: 'boolean' },
          creditLevel: { type: 'integer' },
          maxCredit: { type: 'string', description: 'USDC base units' },
          currentScore: { type: 'integer' },
          kyaTier: { type: 'integer' },
          reasons: { type: 'array', items: { type: 'string' }, description: 'Reasons for ineligibility (empty if eligible)' },
        },
      },
      SolanaCreditLine: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          creditLimit: { type: 'string' },
          creditDrawn: { type: 'string' },
          accruedInterest: { type: 'string' },
          totalInterestPaid: { type: 'string' },
          interestRateBps: { type: 'integer' },
          originatedAt: { type: 'integer', description: 'Unix timestamp' },
          lastAccrualAt: { type: 'integer' },
          isActive: { type: 'boolean' },
        },
      },
      CreditActivity: {
        type: 'object',
        properties: {
          scoreHistory: { type: 'array', items: { type: 'object', properties: { score: { type: 'integer' }, level: { type: 'integer' }, snapshotAt: { type: 'string', format: 'date-time' } } } },
          healthHistory: { type: 'array', items: { type: 'object', properties: { healthFactorBps: { type: 'integer' }, snapshotAt: { type: 'string', format: 'date-time' } } } },
          recentTrades: { type: 'array', items: { $ref: '#/components/schemas/AgentTrade' } },
        },
      },
      AgentWalletSummary: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          owner: { type: 'string' },
          creditLevel: { type: 'integer' },
          totalDebt: { type: 'string' },
          healthFactorBps: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AgentWalletState: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          owner: { type: 'string' },
          walletUsdc: { type: 'string', description: 'USDC token account address' },
          collateralShares: { type: 'string' },
          creditLimit: { type: 'string' },
          creditDrawn: { type: 'string' },
          totalDebt: { type: 'string' },
          dailySpendLimit: { type: 'string' },
          dailySpent: { type: 'string' },
          healthFactorBps: { type: 'integer' },
          creditLevel: { type: 'integer' },
          isFrozen: { type: 'boolean' },
          isLiquidating: { type: 'boolean' },
          totalTrades: { type: 'string' },
          totalVolume: { type: 'string' },
          totalRepaid: { type: 'string' },
          createdAt: { type: 'integer' },
        },
      },
      WalletHealth: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          healthFactorBps: { type: 'integer' },
          healthFactor: { type: 'string', description: 'Human-readable, e.g. "1.35"' },
          status: { type: 'string', enum: ['Active', 'Warning', 'Deleveraging', 'Liquidating', 'Closed'] },
          walletBalance: { type: 'string' },
          collateralValue: { type: 'string' },
          totalDebt: { type: 'string' },
        },
      },
      AgentTrade: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          agent: { type: 'string' },
          venue: { type: 'string' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          amount: { type: 'string' },
          pnl: { type: 'string', nullable: true },
          txSignature: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      SolanaVaultStats: {
        type: 'object',
        properties: {
          totalDeposits: { type: 'string' },
          totalDeployed: { type: 'string' },
          availableLiquidity: { type: 'string' },
          utilizationBps: { type: 'integer' },
          utilizationPct: { type: 'string' },
          insuranceBalance: { type: 'string' },
          isPaused: { type: 'boolean' },
          tranches: {
            type: 'object',
            properties: {
              senior: { type: 'object', properties: { deposits: { type: 'string' }, shares: { type: 'string' }, aprBps: { type: 'integer' } } },
              mezzanine: { type: 'object', properties: { deposits: { type: 'string' }, shares: { type: 'string' }, aprBps: { type: 'integer' } } },
              junior: { type: 'object', properties: { deposits: { type: 'string' }, shares: { type: 'string' }, aprBps: { type: 'integer' } } },
            },
          },
        },
      },
      LPPositions: {
        type: 'object',
        properties: {
          depositor: { type: 'string' },
          positions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tranche: { type: 'string', enum: ['senior', 'mezzanine', 'junior'] },
                shares: { type: 'string' },
                depositAmount: { type: 'string' },
                depositedAt: { type: 'integer' },
                estimatedValue: { type: 'string' },
                estimatedYield: { type: 'string' },
              },
            },
          },
        },
      },
      KrexitScoreResponse: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          score: { type: 'integer', minimum: 200, maximum: 850 },
          level: { type: 'integer' },
          components: {
            type: 'object',
            properties: {
              repayment: { type: 'number', description: '0-100, weight 30%' },
              profitability: { type: 'number', description: '0-100, weight 25%' },
              behavioral: { type: 'number', description: '0-100, weight 20%' },
              usage: { type: 'number', description: '0-100, weight 15%' },
              maturity: { type: 'number', description: '0-100, weight 10%' },
            },
          },
          isPreview: { type: 'boolean', description: 'True if score is a preview (not yet on-chain)' },
          lastUpdated: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      CreditCheck: {
        type: 'object',
        description: 'Simple pass/fail credit check for third-party integration',
        properties: {
          agent: { type: 'string' },
          pass: { type: 'boolean', description: 'Whether the agent passes basic creditworthiness check' },
          score: { type: 'integer', minimum: 200, maximum: 850 },
          tier: { type: 'string', enum: ['none', 'starter', 'established', 'trusted', 'elite'] },
          maxCredit: { type: 'string', description: 'Maximum credit in USDC (human-readable)' },
          riskFlags: { type: 'array', items: { type: 'string' } },
          checkedAt: { type: 'string', format: 'date-time' },
        },
      },
      WebhookDelivery: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          eventType: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'delivered', 'failed'] },
          statusCode: { type: 'integer', nullable: true },
          attempts: { type: 'integer' },
          lastError: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          deliveredAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authenticated access. Admin endpoints require a valid key.',
      },
    },
  },
};
