import rateLimit from "@fastify/rate-limit";
import { FastifyInstance } from "fastify";

export async function registerRateLimit(server: FastifyInstance): Promise<void> {
  await server.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return (request.headers["x-wallet-address"] as string) ?? request.ip;
    },
  });
}
