import pino from 'pino';
import type { Container } from '../../src/config/container';
import { OrderService } from '../../src/services/order.service';
import { OrderController } from '../../src/controllers/order.controller';
import { OrderScheduler } from '../../src/scheduler/order.scheduler';
import { FakeOrderRepository } from './fakeOrderRepository';

/** A silent logger so tests do not pollute the output. */
export const testLogger = pino({ level: 'silent' });

/**
 * Build a fully-wired container backed by the in-memory repository. Returns the
 * container plus the repository so tests can inspect/seed state directly.
 */
export function buildTestContainer(): {
  container: Container;
  repository: FakeOrderRepository;
} {
  const repository = new FakeOrderRepository();
  const orderService = new OrderService(repository, testLogger);
  const orderController = new OrderController(orderService);
  const orderScheduler = new OrderScheduler(orderService, testLogger);
  return {
    container: { orderController, orderService, orderScheduler },
    repository,
  };
}
