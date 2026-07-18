import pino from 'pino';
import { env } from './env';

/**
 * Application-wide structured logger.
 *
 * In development we pretty-print for readability; in production we emit raw JSON
 * so logs can be shipped to a log aggregator (e.g. ELK, Loki, Datadog).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'order-processing-system' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export type Logger = typeof logger;
