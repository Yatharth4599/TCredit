import { FastifyInstance } from "fastify";
import { getKrexaClient } from "../services/krexa.js";
import { Tranche } from "@krexa/solana-sdk";

export async function vaultRoutes(server: FastifyInstance): Promise<void> {
  // GET /vault/stats
  server.get("/stats", async (_request, reply) => {
    try {
      const krexa = getKrexaClient();
      const stats = await krexa.vault.getStats();
      if (!stats) {
        reply.code(503).send({ error: "Vault not initialized" });
        return;
      }
      return stats;
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // GET /vault/tranche/:tranche
  server.get("/tranche/:tranche", async (request, reply) => {
    const { tranche } = request.params as { tranche: string };
    const trancheMap: Record<string, Tranche> = {
      senior: Tranche.Senior,
      mezzanine: Tranche.Mezzanine,
      junior: Tranche.Junior,
    };
    const t = trancheMap[tranche.toLowerCase()];
    if (t === undefined) {
      reply.code(400).send({ error: "Invalid tranche. Use: senior, mezzanine, junior" });
      return;
    }
    try {
      const krexa = getKrexaClient();
      const stats = await krexa.vault.getTrancheStats(t);
      if (!stats) {
        reply.code(503).send({ error: "Vault not initialized" });
        return;
      }
      return stats;
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // GET /vault/revenue
  server.get("/revenue", async (_request, reply) => {
    try {
      const krexa = getKrexaClient();
      const breakdown = await krexa.vault.getRevenueBreakdown();
      if (!breakdown) {
        reply.code(503).send({ error: "Vault not initialized" });
        return;
      }
      return breakdown;
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });

  // GET /vault/loss-buffer
  server.get("/loss-buffer", async (_request, reply) => {
    try {
      const krexa = getKrexaClient();
      const buffer = await krexa.vault.getLossBufferStatus();
      if (!buffer) {
        reply.code(503).send({ error: "Vault not initialized" });
        return;
      }
      return buffer;
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}
