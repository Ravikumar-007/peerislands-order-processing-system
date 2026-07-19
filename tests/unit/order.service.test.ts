import pino from 'pino';
import { OrderService } from '../../src/services/order.service';
import { FakeOrderRepository } from '../helpers/fakeOrderRepository';
import { OrderStatus } from '../../src/types/order.types';
import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../src/utils/errors';

const logger = pino({ level: 'silent' });

function makeService(): { service: OrderService; repo: FakeOrderRepository } {
  const repo = new FakeOrderRepository();
  const service = new OrderService(repo, logger);
  return { service, repo };
}

describe('OrderService', () => {
  describe('createOrder', () => {
    it('computes the total amount from the line items', async () => {
      const { service } = makeService();
      const order = await service.createOrder({
        customerName: 'Jane Doe',
        items: [
          { productName: 'Mouse', quantity: 2, price: 19.99 },
          { productName: 'Keyboard', quantity: 1, price: 49.99 },
        ],
      });

      expect(Number(order.totalAmount)).toBeCloseTo(89.97, 2);
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.items).toHaveLength(2);
    });

    it('rounds totals to two decimal places', async () => {
      const { service } = makeService();
      const order = await service.createOrder({
        customerName: 'Rounding',
        items: [{ productName: 'Widget', quantity: 3, price: 0.1 }],
      });
      expect(Number(order.totalAmount)).toBeCloseTo(0.3, 2);
    });
  });

  describe('getOrderById', () => {
    it('throws NotFoundError for an unknown id', async () => {
      const { service } = makeService();
      await expect(
        service.getOrderById('11111111-1111-1111-1111-111111111111'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateOrderStatus', () => {
    it('allows PENDING -> PROCESSING', async () => {
      const { service } = makeService();
      const order = await service.createOrder({
        customerName: 'A',
        items: [{ productName: 'X', quantity: 1, price: 1 }],
      });
      const updated = await service.updateOrderStatus(order.id, OrderStatus.PROCESSING);
      expect(updated.status).toBe(OrderStatus.PROCESSING);
    });

    it('rejects an invalid transition (PENDING -> SHIPPED) with 422', async () => {
      const { service } = makeService();
      const order = await service.createOrder({
        customerName: 'B',
        items: [{ productName: 'X', quantity: 1, price: 1 }],
      });
      await expect(
        service.updateOrderStatus(order.id, OrderStatus.SHIPPED),
      ).rejects.toBeInstanceOf(UnprocessableEntityError);
    });

    it('rejects transitioning to the same status with 409', async () => {
      const { service } = makeService();
      const order = await service.createOrder({
        customerName: 'C',
        items: [{ productName: 'X', quantity: 1, price: 1 }],
      });
      await expect(
        service.updateOrderStatus(order.id, OrderStatus.PENDING),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('walks the full happy-path lifecycle', async () => {
      const { service } = makeService();
      const order = await service.createOrder({
        customerName: 'D',
        items: [{ productName: 'X', quantity: 1, price: 1 }],
      });
      let current = await service.updateOrderStatus(order.id, OrderStatus.PROCESSING);
      current = await service.updateOrderStatus(current.id, OrderStatus.SHIPPED);
      current = await service.updateOrderStatus(current.id, OrderStatus.DELIVERED);
      expect(current.status).toBe(OrderStatus.DELIVERED);
    });
  });

  describe('cancelOrder', () => {
    it('cancels a PENDING order', async () => {
      const { service } = makeService();
      const order = await service.createOrder({
        customerName: 'E',
        items: [{ productName: 'X', quantity: 1, price: 1 }],
      });
      const cancelled = await service.cancelOrder(order.id);
      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
    });

    it('rejects cancelling a non-PENDING order with 409', async () => {
      const { service } = makeService();
      const order = await service.createOrder({
        customerName: 'F',
        items: [{ productName: 'X', quantity: 1, price: 1 }],
      });
      await service.updateOrderStatus(order.id, OrderStatus.PROCESSING);
      await expect(service.cancelOrder(order.id)).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('listOrders', () => {
    it('filters by status and paginates', async () => {
      const { service } = makeService();
      for (let i = 0; i < 3; i += 1) {
        await service.createOrder({
          customerName: `cust-${i}`,
          items: [{ productName: 'X', quantity: 1, price: 1 }],
        });
      }
      const result = await service.listOrders({
        status: OrderStatus.PENDING,
        page: 1,
        limit: 2,
        sortOrder: 'desc',
      });
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(2);
    });
  });

  describe('promotePendingOrders', () => {
    it('promotes only PENDING orders to PROCESSING', async () => {
      const { service } = makeService();
      const a = await service.createOrder({
        customerName: 'G',
        items: [{ productName: 'X', quantity: 1, price: 1 }],
      });
      await service.createOrder({
        customerName: 'H',
        items: [{ productName: 'X', quantity: 1, price: 1 }],
      });
      await service.updateOrderStatus(a.id, OrderStatus.PROCESSING);

      const promoted = await service.promotePendingOrders();
      expect(promoted).toBe(1);
    });
  });
});
