import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';

/**
 * Single shared PrismaClient instance.
 *
 * A single connection pool is reused across the application. In development we
 * also cache it on `globalThis` to avoid exhausting connections when the module
 * is reloaded by the watcher.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Gracefully close the database connection pool (used on shutdown). */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Prisma disconnected');
}
