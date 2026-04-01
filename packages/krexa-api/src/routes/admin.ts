import { FastifyInstance } from "fastify";
import { getKrexaClient } from "../services/krexa.js";
import { verifyAdmin } from "../middleware/adminGate.js";

export async function adminRoutes(server: FastifyInstance): Promise<void> {
  // All admin routes require admin wallet verification
  server.addHook("preHandler", verifyAdmin);

  // GET /admin/vault-stats (admin-only detailed stats)
  server.get("/vault-stats", async (_request, reply) => {
    try {
      const krexa = getKrexaClient();
      const [stats, revenue, buffer] = await Promise.all([
        krexa.vault.getStats(),
        krexa.vault.getRevenueBreakdown(),
        krexa.vault.getLossBufferStatus(),
      ]);
      return { stats, revenue, lossBuffer: buffer };
    } catch (err: any) {
      reply.code(500).send({ error: err.message });
    }
  });
}
