import { FastifyInstance } from "fastify";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { getKrexaClient } from "../services/krexa.js";
import { verifyWalletSignature } from "../middleware/auth.js";
import { Tranche, usdcToLamports } from "@krexa/solana-sdk";

const TRANCHE_MAP: Record<string, Tranche> = {
  senior: Tranche.Senior,
  mezzanine: Tranche.Mezzanine,
  junior: Tranche.Junior,
};

export async function lpRoutes(server: FastifyInstance): Promise<void> {
  // GET /lp/:address/positions
  server.get("/:address/positions", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const positions = await krexa.lp.getAllPositions(new PublicKey(address));
      // Convert Map to serializable object
      const result: Record<string, any> = {};
      for (const [tranche, pos] of positions) {
        result[Tranche[tranche]] = pos;
      }
      return result;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /lp/:address/position/:tranche
  server.get("/:address/position/:tranche", async (request, reply) => {
    const { address, tranche } = request.params as { address: string; tranche: string };
    const t = TRANCHE_MAP[tranche.toLowerCase()];
    if (t === undefined) {
      reply.code(400).send({ error: "Invalid tranche" });
      return;
    }
    try {
      const krexa = getKrexaClient();
      const position = await krexa.lp.getPosition(new PublicKey(address), t);
      if (!position) {
        reply.code(404).send({ error: "No position in this tranche" });
        return;
      }
      return position;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /lp/preview/deposit
  server.get("/preview/deposit", async (request, reply) => {
    const { tranche, amount } = request.query as { tranche?: string; amount?: string };
    if (!tranche || !amount) {
      reply.code(400).send({ error: "Required query params: tranche, amount" });
      return;
    }
    const t = TRANCHE_MAP[tranche.toLowerCase()];
    if (t === undefined) {
      reply.code(400).send({ error: "Invalid tranche" });
      return;
    }
    try {
      const krexa = getKrexaClient();
      const preview = await krexa.lp.previewDeposit(t, new BN(amount));
      return preview;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /lp/preview/withdraw
  server.get("/preview/withdraw", async (request, reply) => {
    const { tranche, shares } = request.query as { tranche?: string; shares?: string };
    if (!tranche || !shares) {
      reply.code(400).send({ error: "Required query params: tranche, shares" });
      return;
    }
    const t = TRANCHE_MAP[tranche.toLowerCase()];
    if (t === undefined) {
      reply.code(400).send({ error: "Invalid tranche" });
      return;
    }
    try {
      const krexa = getKrexaClient();
      const preview = await krexa.lp.previewWithdraw(t, new BN(shares));
      return preview;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });
}
