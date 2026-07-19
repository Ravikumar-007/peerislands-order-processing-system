import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';
import { env } from '../config/env';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Translate a Prisma error into an HTTP-friendly status/message. */
function mapPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): { statusCode: number; code: string; message: string } {
  switch (error.code) {
    case 'P2025': // Record not found for update/delete
      return { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' };
    case 'P2002': // Unique constraint violation
      return { statusCode: 409, code: 'CONFLICT', message: 'Resource already exists' };
    case 'P2003': // Foreign key constraint failed
      return { statusCode: 400, code: 'BAD_REQUEST', message: 'Invalid reference in request' };
    default:
      return { statusCode: 500, code: 'DATABASE_ERROR', message: 'A database error occurred' };
  }
}

/**
 * Centralized error handler. This is the single place that turns any thrown
 * error into an HTTP response. Stack traces are logged server-side but never
 * returned to the client.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let body: ErrorBody = {
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
  };

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    body = {
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    statusCode = mapped.statusCode;
    body = { error: { code: mapped.code, message: mapped.message } };
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    body = { error: { code: 'BAD_REQUEST', message: 'Invalid data supplied to the database' } };
  }

  // Log full details (including stack) for observability.
  const logPayload = { err, statusCode, method: req.method, path: req.originalUrl };
  if (statusCode >= 500) {
    logger.error(logPayload, 'Request failed');
  } else {
    logger.warn(logPayload, 'Request rejected');
  }

  // Surface stack only in non-production for local debugging.
  if (env.NODE_ENV !== 'production' && statusCode >= 500 && err instanceof Error) {
    (body.error as Record<string, unknown>).stack = err.stack;
  }

  res.status(statusCode).json(body);
}

/** Fallback handler for unmatched routes -> 404. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}
