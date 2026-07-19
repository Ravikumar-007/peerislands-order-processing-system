import pino from 'pino';
import { OrderScheduler } from '../../src/scheduler/order.scheduler';
import { OrderService } from '../../src/services/order.service';
import { FakeOrderRepository } from '../helpers/fakeOrderRepository';
import { OrderStatus } from '../../src/types/order.types';

const logger = pino({ level: 'silent' });

describe('OrderScheduler', () => {
  it('promotes PENDING orders to PROCESSING on run()', async () => {
    const repo = new FakeOrderRepository();
    const service = new OrderService(repo, logger);
    const scheduler = new OrderScheduler(service, logger);

    await service.createOrder({
      customerName: 'A',
      items: [{ productName: 'X', quantity: 1, price: 1 }],
    });
    await service.createOrder({
      customerName: 'B',
      items: [{ productName: 'Y', quantity: 1, price: 1 }],
    });

    const promoted = await scheduler.run();
    expect(promoted).toBe(2);

    const list = await service.listOrders({
      status: OrderStatus.PROCESSING,
      page: 1,
      limit: 10,
      sortOrder: 'desc',
    });
    expect(list.pagination.total).toBe(2);
  });

  it('is a no-op when there are no PENDING orders', async () => {
    const repo = new FakeOrderRepository();
    const service = new OrderService(repo, logger);
    const scheduler = new OrderScheduler(service, logger);

    const promoted = await scheduler.run();
    expect(promoted).toBe(0);
  });

  it('skips overlapping runs via the re-entry guard', async () => {
    const repo = new FakeOrderRepository();
    const service = new OrderService(repo, logger);
    await service.createOrder({
      customerName: 'A',
      items: [{ productName: 'X', quantity: 1, price: 1 }],
    });

    const scheduler = new OrderScheduler(service, logger);
    // Fire two runs concurrently; the guard should let only one do the work.
    const [first, second] = await Promise.all([scheduler.run(), scheduler.run()]);
    expect(first + second).toBe(1);
  });
});
