import { randomUUID } from 'node:crypto';
import type {
  CreateOrderData,
  IOrderRepository,
} from '../../src/repositories/order.repository';
import {
  OrderStatus,
  type ListOrdersOptions,
  type OrderWithItems,
} from '../../src/types/order.types';

/**
 * In-memory implementation of {@link IOrderRepository}.
 *
 * Because the service depends only on the repository interface, this fake lets
 * us exercise the full business logic (and the HTTP stack, in integration tests)
 * deterministically without a PostgreSQL instance.
 */
export class FakeOrderRepository implements IOrderRepository {
  private readonly orders = new Map<string, OrderWithItems>();
  private sequence = 0;

  async create(data: CreateOrderData): Promise<OrderWithItems> {
    const id = randomUUID();
    // Deterministic, monotonically increasing timestamps for stable sorting.
    const createdAt = new Date(2024, 0, 1, 0, 0, this.sequence++);
    const order: OrderWithItems = {
      id,
      customerName: data.customerName,
      status: OrderStatus.PENDING,
      // The Decimal type accepts a number; presenter converts back with Number().
      totalAmount: data.totalAmount as unknown as OrderWithItems['totalAmount'],
      createdAt,
      updatedAt: createdAt,
      items: data.items.map((item) => ({
        id: randomUUID(),
        orderId: id,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price as unknown as OrderWithItems['items'][number]['price'],
      })),
    };
    this.orders.set(id, order);
    return structuredClone(order);
  }

  async findById(id: string): Promise<OrderWithItems | null> {
    const order = this.orders.get(id);
    return order ? structuredClone(order) : null;
  }

  async findMany(
    options: ListOrdersOptions,
  ): Promise<{ data: OrderWithItems[]; total: number }> {
    let all = [...this.orders.values()];
    if (options.status) {
      all = all.filter((o) => o.status === options.status);
    }
    all.sort((a, b) => {
      const diff = a.createdAt.getTime() - b.createdAt.getTime();
      return options.sortOrder === 'asc' ? diff : -diff;
    });
    const total = all.length;
    const start = (options.page - 1) * options.limit;
    const data = all.slice(start, start + options.limit).map((o) => structuredClone(o));
    return { data, total };
  }

  async updateStatus(id: string, status: OrderStatus): Promise<OrderWithItems> {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error(`Order ${id} not found`);
    }
    order.status = status;
    order.updatedAt = new Date(2024, 0, 1, 1, 0, this.sequence++);
    this.orders.set(id, order);
    return structuredClone(order);
  }

  async updateStatusForAll(from: OrderStatus, to: OrderStatus): Promise<number> {
    let count = 0;
    for (const order of this.orders.values()) {
      if (order.status === from) {
        order.status = to;
        count += 1;
      }
    }
    return count;
  }
}
