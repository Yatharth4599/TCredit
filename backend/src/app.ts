import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './api/middleware/cors.js';
import { requestLogger } from './api/middleware/requestLogger.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { apiKeyAuth } from './api/middleware/apiKeyAuth.js';
import { rateLimit } from './api/middleware/rateLimit.js';
import apiRoutes from './api/routes/index.js';
import docsRoutes from './api/routes/docs.js';
import adminRoutes from './api/routes/admin.js';

// BigInt JSON serialization (Prisma returns BigInt for large numbers)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(corsMiddleware);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// API key auth (optional — sets req.apiKey if valid key provided)
app.use(apiKeyAuth as never);

// Rate limiting (30 req/min anonymous, per-key limit for authenticated)
app.use(rateLimit as never);

// API routes — canonical path
app.use('/api/v1', apiRoutes);

// Backward-compat: frontend client.ts uses baseURL http://localhost:3001/api
app.use('/api', apiRoutes);

// API documentation
app.use('/api/v1/docs', docsRoutes);
app.use('/api/docs', docsRoutes);

// Admin routes (API key required)
app.use('/api/v1/admin', adminRoutes);
app.use('/api/admin', adminRoutes);

// Error handling (must be last)
app.use(errorHandler);

export default app;
