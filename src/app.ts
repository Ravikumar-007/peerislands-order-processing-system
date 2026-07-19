import express, { type Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import type { Container } from './config/container';
import { createApiRouter } from './routes';
import { swaggerSpec } from './config/swagger';
import { requestLogger } from './middleware/requestLogger.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

/**
 * Build and configure the Express application from a DI container.
 *
 * Kept separate from the server bootstrap so integration tests can import the
 * fully-wired app (with a test container) without opening a port.
 */
export function createApp(container: Container): Application {
  const app = express();

  // Core middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // API docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

  // Versioned API routes
  app.use('/api/v1', createApiRouter(container));

  // 404 + centralized error handling (must be registered last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
