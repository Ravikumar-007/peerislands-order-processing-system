import type { PrismaClient } from '@prisma/client';
import { OrderRepository } from '../repositories/order.repository';
import { OrderService } from '../services/order.service';
import { OrderController } from '../controllers/order.controller';
import { OrderScheduler } from '../scheduler/order.scheduler';
import { prisma as defaultPrisma } from './prisma';
import { logger } from './logger';

/**
 * Composition root.
 *
 * A tiny, framework-free dependency-injection container. Wiring lives in exactly
 * one place, so it is obvious how the layers connect and trivial to substitute
 * fakes in tests. Prisma is a parameter so tests can pass their own client.
 */
export interface Container {
  orderController: OrderController;
  orderService: OrderService;
  orderScheduler: OrderScheduler;
}

export function createContainer(prisma: PrismaClient = defaultPrisma): Container {
  const orderRepository = new OrderRepository(prisma);
  const orderService = new OrderService(orderRepository, logger);
  const orderController = new OrderController(orderService);
  const orderScheduler = new OrderScheduler(orderService, logger);

  return { orderController, orderService, orderScheduler };
}
