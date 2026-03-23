import { FastifyRequest, FastifyReply } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { verifyWalletSignature } from "./auth.js";

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS ?? "").split(",").filter(Boolean);

export async function verifyAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await verifyWalletSignature(request, reply);
  if (reply.sent) return;

  if (!request.walletAddress) {
    reply.code(401).send({ error: "Authentication required" });
    return;
  }

  const walletStr = request.walletAddress.toBase58();
  if (!ADMIN_WALLETS.includes(walletStr)) {
    reply.code(403).send({ error: "Admin access required" });
    return;
  }
}
