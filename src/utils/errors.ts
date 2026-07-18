/**
 * Application error hierarchy.
 *
 * Every operational error carries an HTTP status code and a stable, machine-
 * readable `code`. The centralized error middleware uses these to build a
 * consistent response without ever leaking stack traces to clients.
 */
export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly code: string;
  /** Operational errors are expected (validation, not-found, …) and safe to expose. */
  public readonly isOperational = true;
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 - malformed input the caller can fix. */
export class BadRequestError extends AppError {
  public readonly statusCode = 400;
  public readonly code = 'BAD_REQUEST';
}

/** 400 - request body failed schema validation. */
export class ValidationError extends AppError {
  public readonly statusCode = 400;
  public readonly code = 'VALIDATION_ERROR';
}

/** 404 - the requested resource does not exist. */
export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly code = 'NOT_FOUND';
}

/** 409 - the request conflicts with the current state of the resource. */
export class ConflictError extends AppError {
  public readonly statusCode = 409;
  public readonly code = 'CONFLICT';
}

/** 422 - the transition/operation is semantically invalid. */
export class UnprocessableEntityError extends AppError {
  public readonly statusCode = 422;
  public readonly code = 'UNPROCESSABLE_ENTITY';
}
