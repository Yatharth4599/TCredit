import express, { Request, Response, NextFunction } from "express";
import { Connection, PublicKey } from "@solana/web3.js";

export interface X402ServerConfig {
  /** Agent's Solana public key */
  agentPubkey: string;
  /** Revenue Router's USDC token account — payments go HERE, not to agent wallet */
  revenueRouterAddress: string;
  /** Network */
  network?: "devnet" | "mainnet-beta";
  /** Port (default 3402) */
  port?: number;
  /** RPC URL (defaults based on network) */
  rpcUrl?: string;
}

export interface X402Endpoint {
  path: string;
  method: string;
  priceUsdc: string;
  description: string;
  handler: (req: Request, res: Response) => void | Promise<void>;
}

export function createX402Server(config: X402ServerConfig) {
  const app = express();
  app.use(express.json());

  const network = config.network ?? "devnet";
  const rpcUrl = config.rpcUrl ?? (network === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com");

  const endpoints: X402Endpoint[] = [];

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      agent: config.agentPubkey,
      network,
      endpoints: endpoints.map(e => ({ path: e.path, method: e.method, price: e.priceUsdc })),
    });
  });

  // x402 discovery
  app.get("/.well-known/x402", (_req: Request, res: Response) => {
    res.json({
      version: "1.0",
      agent: config.agentPubkey,
      network: `solana:${network}`,
      revenueRouter: config.revenueRouterAddress,
      endpoints: endpoints.map(e => ({
        path: e.path,
        method: e.method,
        price: e.priceUsdc,
        currency: "USDC",
        recipient: config.revenueRouterAddress,
        description: e.description,
      })),
    });
  });

  // Helper to register x402-protected endpoints
  function addPaidEndpoint(endpoint: X402Endpoint) {
    endpoints.push(endpoint);

    const method = endpoint.method.toLowerCase() as "get" | "post";
    app[method](endpoint.path, async (req: Request, res: Response) => {
      const paymentToken = req.headers["x-payment-token"] as string | undefined;

      if (!paymentToken) {
        return res.status(402).json({
          "x-payment-required": true,
          scheme: "x402",
          payment: {
            recipient: config.revenueRouterAddress,
            amount: endpoint.priceUsdc,
            currency: "USDC",
            network: `solana:${network}`,
            memo: `krexa:${config.agentPubkey}`,
          },
          description: endpoint.description,
          docsUrl: "https://krexa.mintlify.app/docs/x402",
        });
      }

      // Verify payment (check tx signature on-chain)
      try {
        const verified = await verifyPayment(paymentToken, rpcUrl, config.revenueRouterAddress);
        if (!verified) {
          return res.status(402).json({ error: "Payment verification failed" });
        }
      } catch {
        return res.status(402).json({ error: "Payment verification error" });
      }

      // Payment verified — call the handler
      await endpoint.handler(req, res);
    });
  }

  return { app, addPaidEndpoint, config };
}

async function verifyPayment(
  token: string,
  rpcUrl: string,
  expectedRecipient: string,
): Promise<boolean> {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    const signature = decoded.signature;
    if (!signature) return false;

    const connection = new Connection(rpcUrl, "confirmed");
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || tx.meta?.err) return false;

    // Check that the transaction involved the expected recipient
    const accountKeys = tx.transaction.message.getAccountKeys();
    const recipientKey = new PublicKey(expectedRecipient);
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys.get(i)?.equals(recipientKey)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

export { express };
