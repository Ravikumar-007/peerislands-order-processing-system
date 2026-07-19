import type { NextFunction, Request, Response } from 'express';
import { ZodError, type AnyZodObject } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Generic request-validation middleware.
 *
 * Validates `body`, `params` and `query` against the supplied Zod schema and
 * replaces them with the parsed (typed & coerced) values, so downstream handlers
 * receive clean data. Any failure is converted to a {@link ValidationError} and
 * handed to the centralized error middleware.
 */
export const validate =
  (schema: AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.params !== undefined) req.params = parsed.params;
      // req.query is a getter-only property in some Express versions; assign safely.
      if (parsed.query !== undefined) {
        Object.defineProperty(req, 'query', { value: parsed.query, configurable: true });
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((issue) => ({
          field: issue.path.filter((p) => p !== 'body' && p !== 'params' && p !== 'query').join('.'),
          message: issue.message,
        }));
        next(new ValidationError('Request validation failed', details));
        return;
      }
      next(error);
    }
  };
