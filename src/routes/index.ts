import { Router } from 'express';
import type { Container } from '../config/container';
import { createOrderRouter } from './order.routes';

/** Health-check payload type. */
interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

/** Build the top-level API router from the DI container. */
export function createApiRouter(container: Container): Router {
  const router = Router();

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Liveness/health check
   *     tags: [System]
   *     responses:
   *       200:
   *         description: Service is healthy
   */
  router.get('/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      service: 'order-processing-system',
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(body);
  });

  router.use('/orders', createOrderRouter(container.orderController));

  return router;
}
