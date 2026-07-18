import type { PrismaClient } from '@prisma/client';
import type {
  ListOrdersOptions,
  OrderStatus,
  OrderWithItems,
} from '../types/order.types';

/** Data required by the repository to persist a new order. */
export interface CreateOrderData {
  customerName: string;
  totalAmount: number;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
}

/**
 * Persistence contract for orders.
 *
 * The service layer depends on this interface, never on Prisma directly. This
 * keeps business logic decoupled from the ORM and makes the service trivially
 * unit-testable with an in-memory or mocked repository.
 */
export interface IOrderRepository {
  create(data: CreateOrderData): Promise<OrderWithItems>;
  findById(id: string): Promise<OrderWithItems | null>;
  findMany(
    options: ListOrdersOptions,
  ): Promise<{ data: OrderWithItems[]; total: number }>;
  updateStatus(id: string, status: OrderStatus): Promise<OrderWithItems>;
  /** Bulk status transition used by the scheduler. Returns the number of rows updated. */
  updateStatusForAll(from: OrderStatus, to: OrderStatus): Promise<number>;
}

/** Prisma-backed implementation of {@link IOrderRepository}. */
export class OrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateOrderData): Promise<OrderWithItems> {
    // Nested writes run inside a single implicit transaction, so the order and
    // all of its items are committed atomically.
    return this.prisma.order.create({
      data: {
        customerName: data.customerName,
        totalAmount: data.totalAmount,
        items: {
          create: data.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: { items: true },
    });
  }

  async findById(id: string): Promise<OrderWithItems | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  async findMany(
    options: ListOrdersOptions,
  ): Promise<{ data: OrderWithItems[]; total: number }> {
    const { status, page, limit, sortOrder } = options;
    const where = status ? { status } : {};

    // Run count and page query concurrently.
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total };
  }

  async updateStatus(id: string, status: OrderStatus): Promise<OrderWithItems> {
    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
  }

  async updateStatusForAll(
    from: OrderStatus,
    to: OrderStatus,
  ): Promise<number> {
    const result = await this.prisma.order.updateMany({
      where: { status: from },
      data: { status: to },
    });
    return result.count;
  }
}
