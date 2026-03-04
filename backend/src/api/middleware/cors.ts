import cors from 'cors';
import { env } from '../../config/env.js';

const devOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000'];

const allowedOrigins: string[] = env.CORS_ORIGIN
  ? [...devOrigins, ...env.CORS_ORIGIN.split(',').map((o: string) => o.trim())]
  : devOrigins;

export const corsMiddleware = cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
});
