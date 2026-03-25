import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Express middleware factory for Zod request body validation.
 *
 * Usage:
 *   router.post('/foo', validate(fooSchema), handler);
 *
 * On validation failure, responds with 400 and a structured error:
 *   { error: "Validation failed", issues: [...] }
 *
 * On success, replaces `req.body` with the parsed (typed, coerced) data
 * so downstream handlers never touch raw input.
 */
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));

      res.status(400).json({
        error: 'Validation failed',
        issues,
      });
      return;
    }

    // Replace raw body with parsed + coerced data
    req.body = result.data;
    next();
  };
}
