import { FastifyInstance } from "fastify";

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  server.get("/health", async () => ({
    status: "ok",
    version: "0.1.0",
    timestamp: Date.now(),
  }));
}
