import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(`[ERROR] ${err.message}`, err.stack);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  // BUG-044 fix: never leak internal error details to clients
  // Full error already logged to console above
  res.status(500).json({
    error: 'InternalError',
    message: 'Internal server error',
    statusCode: 500,
  });
}
