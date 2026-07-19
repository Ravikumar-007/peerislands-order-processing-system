import pinoHttp from 'pino-http';
import { logger } from '../config/logger';

/**
 * HTTP request logging middleware built on pino-http. Emits one structured log
 * line per request with method, path, status code and latency, and attaches a
 * child logger to `req.log` for use inside handlers.
 */
export const requestLogger = pinoHttp({
  logger,
  customLogLevel(_req, res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} -> ${res.statusCode}`;
  },
});
