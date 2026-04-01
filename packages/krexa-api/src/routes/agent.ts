import { FastifyInstance } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { getKrexaClient } from "../services/krexa.js";
import { verifyWalletSignature } from "../middleware/auth.js";
import { lamportsToUsdc } from "@krexa/solana-sdk";

export async function agentRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('preHandler', verifyWalletSignature);

  // GET /agent/:address/profile
  server.get("/:address/profile", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const profile = await krexa.agent.getProfile(new PublicKey(address));
      if (!profile) {
        reply.code(404).send({ error: "Agent not found" });
        return;
      }
      return profile;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /agent/:address/wallet
  server.get("/:address/wallet", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const wallet = await krexa.agent.getWallet(new PublicKey(address));
      if (!wallet) {
        reply.code(404).send({ error: "Agent wallet not found" });
        return;
      }
      return wallet;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /agent/:address/health
  server.get("/:address/health", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const health = await krexa.agent.getHealth(new PublicKey(address));
      if (!health) {
        reply.code(404).send({ error: "Agent not found" });
        return;
      }
      return health;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /agent/:address/score
  server.get("/:address/score", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const profile = await krexa.agent.getProfile(new PublicKey(address));
      if (!profile) {
        reply.code(404).send({ error: "Agent not found" });
        return;
      }
      return {
        agentPubkey: address,
        score: profile.creditScore,
        level: profile.creditLevel,
        kyaTier: profile.kyaTier,
      };
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /agent/:address/terms
  server.get("/:address/terms", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const terms = await krexa.agent.getTerms(new PublicKey(address));
      if (!terms) {
        reply.code(404).send({ error: "Agent not found" });
        return;
      }
      return terms;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });

  // GET /agent/:address/service-plan
  server.get("/:address/service-plan", async (request, reply) => {
    const { address } = request.params as { address: string };
    try {
      const krexa = getKrexaClient();
      const plan = await krexa.agent.getServicePlan(new PublicKey(address));
      if (!plan) {
        reply.code(404).send({ error: "Service plan not found" });
        return;
      }
      return plan;
    } catch (err: any) {
      reply.code(400).send({ error: err.message });
    }
  });
}
