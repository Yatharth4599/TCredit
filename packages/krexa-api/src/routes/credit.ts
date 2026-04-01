import { FastifyInstance } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { getKrexaClient } from "../services/krexa.js";
import { verifyWalletSignature } from "../middleware/auth.js";

export async function creditRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('preHandler', verifyWalletSignature);

  // GET /credit/:address/line
  server.get("/:address/line", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const line = await krexa.agent.getCreditLine(new PublicKey(address));
      if (!line) {
        reply.code(404).send({ error: "No active credit line" });
        return;
      }
      return line;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /credit/:address/repayment-estimate
  server.get("/:address/repayment-estimate", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const estimate = await krexa.agent.estimateRepaymentTime(new PublicKey(address));
      if (!estimate) {
        reply.code(404).send({ error: "No active debt" });
        return;
      }
      return estimate;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /credit/:address/upgrade-check
  server.get("/:address/upgrade-check", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const result = await krexa.agent.checkLevelUpgrade(new PublicKey(address));
      return result;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });
}
