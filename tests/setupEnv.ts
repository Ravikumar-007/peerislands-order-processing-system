/**
 * Runs before any test module is imported (jest `setupFiles`). It provides the
 * environment variables required by `src/config/env.ts` so importing the app in
 * tests does not fail fast. The DATABASE_URL is never connected to — unit and
 * integration tests use the in-memory fake repository.
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.SCHEDULER_ENABLED = 'false';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/order_processing_test?schema=public';
