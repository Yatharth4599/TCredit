import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './api/middleware/cors.js';
import { requestLogger } from './api/middleware/requestLogger.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import apiRoutes from './api/routes/index.js';

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

// API routes — canonical path
app.use('/api/v1', apiRoutes);

// Backward-compat: frontend client.ts uses baseURL http://localhost:3001/api
app.use('/api', apiRoutes);

// Error handling (must be last)
app.use(errorHandler);

export default app;
