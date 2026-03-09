import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  uploadKickstartMetadata,
  buildCreateToken,
  buildBuyToken,
  buildCreditAndLaunch,
  getKickstartTokens,
} from '../client.js';

export function registerKickstartTools(server: McpServer) {
  // kickstart_upload_metadata — upload token metadata to EasyA Kickstart
  server.tool(
    'kickstart_upload_metadata',
    'Upload token metadata (name, ticker, description, image) to EasyA Kickstart. Returns a metadata URI for token creation.',
    {
      name: z.string().describe('Token name (e.g. "Krexa Agent Fund")'),
      ticker: z.string().describe('Token ticker/symbol (e.g. "KAF")'),
      description: z.string().describe('Token description'),
      imageUrl: z.string().optional().describe('URL to token image (PNG/JPG)'),
    },
    async ({ name, ticker, description, imageUrl }) => {
      const result = await uploadKickstartMetadata({ name, ticker, description, imageUrl });
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Metadata uploaded successfully!`,
            `URI: ${result.uri}`,
            ``,
            `Use this URI with kickstart_create_token to deploy the token on-chain.`,
          ].join('\n'),
        }],
      };
    },
  );

  // kickstart_create_token — build unsigned createToken tx for Base mainnet
  server.tool(
    'kickstart_create_token',
    'Build an unsigned transaction to create a new token on EasyA Kickstart (Base mainnet). Token starts with a bonding curve and graduates to Aerodrome DEX at ~4.5 ETH.',
    {
      name: z.string().describe('Token name'),
      symbol: z.string().describe('Token symbol/ticker'),
      uri: z.string().describe('Metadata URI from kickstart_upload_metadata'),
      initialBuyEth: z.string().optional().describe('Optional ETH to spend on initial buy (e.g. "0.01")'),
    },
    async ({ name, symbol, uri, initialBuyEth }) => {
      const tx = await buildCreateToken({ name, symbol, uri, initialBuyEth });
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Unsigned createToken transaction (Base mainnet):`,
            `  To: ${tx.to}`,
            `  Data: ${tx.data}`,
            `  Value: ${tx.value} wei`,
            `  Chain ID: ${tx.chainId}`,
            `  Description: ${tx.description}`,
            ``,
            `Sign and submit on Base mainnet:`,
            `  cast send ${tx.to} --data ${tx.data} --value ${tx.value} --rpc-url https://mainnet.base.org --private-key <KEY>`,
          ].join('\n'),
        }],
      };
    },
  );

  // kickstart_buy_token — build unsigned buy tx for existing Kickstart token
  server.tool(
    'kickstart_buy_token',
    'Build an unsigned transaction to buy tokens on an existing Kickstart bonding curve (Base mainnet).',
    {
      curveAddress: z.string().describe('Bonding curve contract address'),
      ethAmount: z.string().describe('ETH to spend (e.g. "0.1")'),
      minTokensOut: z.string().optional().describe('Minimum tokens to receive (slippage protection, default 0)'),
    },
    async ({ curveAddress, ethAmount, minTokensOut }) => {
      const tx = await buildBuyToken({ curveAddress, ethAmount, minTokensOut });
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Unsigned buy transaction (Base mainnet):`,
            `  To: ${tx.to}`,
            `  Data: ${tx.data}`,
            `  Value: ${tx.value} wei`,
            `  Chain ID: ${tx.chainId}`,
            `  Description: ${tx.description}`,
            ``,
            `Sign and submit on Base mainnet:`,
            `  cast send ${tx.to} --data ${tx.data} --value ${tx.value} --rpc-url https://mainnet.base.org --private-key <KEY>`,
          ].join('\n'),
        }],
      };
    },
  );

  // kickstart_credit_and_launch — combined flow: draw Krexa credit + create Kickstart token
  server.tool(
    'kickstart_credit_and_launch',
    'Combined flow: draw credit from a Krexa vault (Base Sepolia) and create a token on EasyA Kickstart (Base mainnet). Returns ordered steps to execute.',
    {
      name: z.string().describe('Token name'),
      symbol: z.string().describe('Token symbol/ticker'),
      description: z.string().optional().describe('Token description'),
      vaultAddress: z.string().optional().describe('Krexa credit vault address to draw from (Base Sepolia)'),
      imageUrl: z.string().optional().describe('URL to token image'),
      initialBuyEth: z.string().optional().describe('ETH to spend on initial token buy'),
    },
    async ({ name, symbol, description, vaultAddress, imageUrl, initialBuyEth }) => {
      const result = await buildCreditAndLaunch({
        name,
        symbol,
        description,
        vaultAddress,
        imageUrl,
        initialBuyEth,
      });

      const stepsText = result.steps.map(s => {
        const lines = [
          `Step ${s.step}: ${s.action} (${s.network})`,
          `  ${s.description}`,
        ];
        if (s.tx) {
          lines.push(`  To: ${s.tx.to}`);
          lines.push(`  Data: ${s.tx.data}`);
          if (s.tx.value && s.tx.value !== '0') lines.push(`  Value: ${s.tx.value}`);
        }
        if (s.note) lines.push(`  Note: ${s.note}`);
        return lines.join('\n');
      }).join('\n\n');

      return {
        content: [{
          type: 'text' as const,
          text: [
            `Credit + Launch Flow (${result.totalSteps} steps):`,
            ``,
            stepsText,
            ``,
            result.note,
          ].join('\n'),
        }],
      };
    },
  );

  // kickstart_list_tokens — list recently created tokens
  server.tool(
    'kickstart_list_tokens',
    'List recently created tokens on EasyA Kickstart (Base mainnet).',
    {
      start: z.number().optional().describe('Start index (default 0)'),
      count: z.number().optional().describe('Number of tokens to fetch (default 20)'),
    },
    async ({ start, count }) => {
      const result = await getKickstartTokens(start, count);
      const lines = result.tokens.map((t, i) =>
        `${(start ?? 0) + i + 1}. Curve: ${t.curve} | Token: ${t.token ?? 'unknown'}`
      );
      return {
        content: [{
          type: 'text' as const,
          text: [
            `Kickstart Tokens (${result.total} found):`,
            ``,
            ...lines,
          ].join('\n'),
        }],
      };
    },
  );
}
