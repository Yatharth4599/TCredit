import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { agentRoutes } from "./routes/agent.js";
import { creditRoutes } from "./routes/credit.js";
import { vaultRoutes } from "./routes/vault.js";
import { lpRoutes } from "./routes/lp.js";
import { adminRoutes } from "./routes/admin.js";
import { registerRateLimit } from "./middleware/rateLimit.js";

async function main() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  // CORS
  await server.register(cors, {
    origin: [
      "https://app.krexa.xyz",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
  });

  // Rate limiting
  await registerRateLimit(server);

  // Routes
  await server.register(healthRoutes);
  await server.register(agentRoutes, { prefix: "/agent" });
  await server.register(creditRoutes, { prefix: "/credit" });
  await server.register(vaultRoutes, { prefix: "/vault" });
  await server.register(lpRoutes, { prefix: "/lp" });
  await server.register(adminRoutes, { prefix: "/admin" });

  // Global error handler
  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    reply.code(error.statusCode ?? 500).send({
      error: error.message ?? "Internal server error",
    });
  });

  const port = parseInt(process.env.PORT ?? "3001", 10);
  const host = process.env.HOST ?? "0.0.0.0";

  await server.listen({ port, host });
  server.log.info(`Krexa API listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
