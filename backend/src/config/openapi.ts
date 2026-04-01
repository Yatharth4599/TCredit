import { addresses } from './contracts.js';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Krexa API',
    version: '0.1.0',
    description:
      'Krexa — programmable credit vaults on Base. All monetary values are USDC wei strings (6 decimals). All write endpoints return unsigned transactions `{ to, data }` for client-side signing.',
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
        description: 'The oracle signs the payment with ECDSA and submits it to the PaymentRouter contract. Requires an admin-tier API key.',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OraclePaymentRequest' } } },
        },
        responses: {
          200: { description: 'Payment confirmed on-chain' },
          202: { description: 'Payment submitted, awaiting confirmation' },
          401: { description: 'API key required' },
          403: { description: 'Admin API key required' },
        },
      },
    },
    '/oracle/verify-payment': {
      post: {
        tags: ['Oracle'],
        summary: 'Verify x402 payment token',
        description: 'Validates that a payment token maps to a confirmed oracle payment for recipient and minimum amount.',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OracleVerifyPaymentRequest' } } },
        },
        responses: {
          200: {
            description: 'Verification result',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OracleVerifyPaymentResponse' } } },
          },
          401: { description: 'API key required' },
        },
      },
    },
    '/oracle/health': {
      get: {
        tags: ['Oracle'],
        summary: 'Oracle service status',
        security: [{ ApiKeyAuth: [] }],
        responses: { 200: { description: 'Oracle health' }, 503: { description: 'Oracle down' } },
      },
    },
    '/oracle/payments': {
      get: {
        tags: ['Oracle'],
        summary: 'List oracle-processed payments',
        security: [{ ApiKeyAuth: [] }],
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
          to: { type: 'string', description: 'Contract address' },
          data: { type: 'string', description: 'ABI-encoded calldata' },
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
      OracleVerifyPaymentRequest: {
        type: 'object',
        required: ['token', 'recipient', 'amountUsdc'],
        properties: {
          token: { type: 'string', description: 'x402 payment token (JWT-like payload)' },
          recipient: { type: 'string', description: '0x merchant recipient address' },
          amountUsdc: { type: 'number', description: 'Minimum required USDC amount in human units' },
        },
      },
      OracleVerifyPaymentResponse: {
        type: 'object',
        required: ['valid'],
        properties: {
          valid: { type: 'boolean' },
          reason: { type: 'string', nullable: true },
          paymentId: { type: 'string', nullable: true },
          txHash: { type: 'string', nullable: true },
          amount: { type: 'string', nullable: true },
          status: { type: 'string', nullable: true },
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
