import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPaymentTools } from './tools/payment.tools.js';
import { registerCreditTools } from './tools/credit.tools.js';
import { registerMerchantTools } from './tools/merchant.tools.js';
import { registerWalletTools } from './tools/wallet.tools.js';
import { registerKickstartTools } from './tools/kickstart.tools.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'krexa',
    version: '0.1.0',
  });

  registerPaymentTools(server);
  registerCreditTools(server);
  registerMerchantTools(server);
  registerWalletTools(server);
  registerKickstartTools(server);

  return server;
}
