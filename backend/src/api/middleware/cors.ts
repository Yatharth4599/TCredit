import cors from 'cors';

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5001',
  'https://krexa.xyz',
  'https://www.krexa.xyz',
];

// Allow additional origins via CORS_ORIGIN env var (comma-separated)
const extraOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : [];

export const corsMiddleware = cors({
  origin: [...defaultOrigins, ...extraOrigins],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
});
