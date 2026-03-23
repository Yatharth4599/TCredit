import { FastifyRequest, FastifyReply } from "fastify";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

declare module "fastify" {
  interface FastifyRequest {
    walletAddress?: PublicKey;
  }
}

export async function verifyWalletSignature(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const signature = request.headers["x-wallet-signature"] as string | undefined;
  const publicKey = request.headers["x-wallet-address"] as string | undefined;
  const timestamp = request.headers["x-timestamp"] as string | undefined;

  if (!signature || !publicKey || !timestamp) {
    reply.code(401).send({ error: "Missing auth headers: x-wallet-signature, x-wallet-address, x-timestamp" });
    return;
  }

  // Reject if timestamp is more than 5 minutes old
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age > 300_000 || age < -60_000) {
    reply.code(401).send({ error: "Timestamp expired or invalid" });
    return;
  }

  try {
    const message = new TextEncoder().encode(
      `krexa:${request.method}:${request.url}:${timestamp}`
    );
    const sig = bs58.decode(signature);
    const pk = new PublicKey(publicKey).toBytes();

    if (!nacl.sign.detached.verify(message, sig, pk)) {
      reply.code(401).send({ error: "Invalid wallet signature" });
      return;
    }

    request.walletAddress = new PublicKey(publicKey);
  } catch {
    reply.code(401).send({ error: "Invalid signature or public key format" });
  }
}
