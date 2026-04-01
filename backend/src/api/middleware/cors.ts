import cors from 'cors';
import { env } from '../../config/env.js';

const productionOrigins = [
  'https://krexa.xyz',
  'https://www.krexa.xyz',
];

const devOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5001',
];

const defaultOrigins = env.NODE_ENV === 'production'
  ? productionOrigins
  : [...productionOrigins, ...devOrigins];

// Allow additional origins via CORS_ORIGIN env var (comma-separated, must be valid URLs)
const extraOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(',')
      .map(o => o.trim())
      .filter(Boolean)
      .filter(o => {
        try { new URL(o); return true; } catch { return false; }
      })
  : [];

export const corsMiddleware = cors({
  origin: [...defaultOrigins, ...extraOrigins],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
});
