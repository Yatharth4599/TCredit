import cors from 'cors';

export const corsMiddleware = cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000', 'http://localhost:5001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
});
