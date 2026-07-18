import type { NextFunction, Request, Response, RequestHandler } from 'express';

/**
 * Wraps an async route handler so any rejected promise is forwarded to the
 * centralized error middleware, avoiding repetitive try/catch in controllers.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
