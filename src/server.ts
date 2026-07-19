import type { Server } from 'node:http';
import { createApp } from './app';
import { createContainer } from './config/container';
import { env } from './config/env';
import { logger } from './config/logger';
import { disconnectPrisma } from './config/prisma';

/**
 * Application entry point. Wires the container, starts the HTTP server and the
 * background scheduler, and installs graceful-shutdown handlers.
 */
function bootstrap(): void {
  const container = createContainer();
  const app = createApp(container);

  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `🚀 Order Processing System listening on http://localhost:${env.PORT}`,
    );
    logger.info(`📚 API docs available at http://localhost:${env.PORT}/api-docs`);
  });

  container.orderScheduler.start();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down gracefully...');
    container.orderScheduler.stop();
    server.close(() => logger.info('HTTP server closed'));
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
}

bootstrap();
