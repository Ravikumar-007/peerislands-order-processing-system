import type { Logger } from 'pino';
import type { IOrderRepository } from '../repositories/order.repository';
import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../utils/errors';
import { isValidTransition } from '../utils/orderStatus';
import {
  OrderStatus,
  type CreateOrderInput,
  type ListOrdersOptions,
  type OrderWithItems,
  type PaginatedResult,
} from '../types/order.types';

/**
 * Encapsulates all order business rules. The service is intentionally unaware of
 * HTTP and of the ORM: it depends only on the {@link IOrderRepository}
 * abstraction (injected via the constructor) and returns domain objects.
 */
export class OrderService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Create a new order.
   *
   * The total amount is computed on the server from the submitted line items —
   * the client is never trusted to send a total.
   */
  async createOrder(input: CreateOrderInput): Promise<OrderWithItems> {
    const totalAmount = input.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0,
    );

    // Guard against floating-point surprises before persisting.
    const roundedTotal = Math.round(totalAmount * 100) / 100;

    const order = await this.orderRepository.create({
      customerName: input.customerName,
      totalAmount: roundedTotal,
      items: input.items,
    });

    this.logger.info(
      { orderId: order.id, totalAmount: roundedTotal, itemCount: input.items.length },
      'Order created',
    );
    return order;
  }

  /** Fetch a single order with its items, or throw 404. */
  async getOrderById(id: string): Promise<OrderWithItems> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundError(`Order with id "${id}" was not found`);
    }
    return order;
  }

  /** List orders with optional status filter, pagination and sorting. */
  async listOrders(
    options: ListOrdersOptions,
  ): Promise<PaginatedResult<OrderWithItems>> {
    const { data, total } = await this.orderRepository.findMany(options);
    return {
      data,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / options.limit)),
      },
    };
  }

  /**
   * Advance an order to a new status, enforcing the allowed state machine:
   * PENDING → PROCESSING → SHIPPED → DELIVERED.
   */
  async updateOrderStatus(
    id: string,
    nextStatus: OrderStatus,
  ): Promise<OrderWithItems> {
    const order = await this.getOrderById(id);

    if (order.status === nextStatus) {
      throw new ConflictError(`Order is already in status "${nextStatus}"`);
    }

    if (!isValidTransition(order.status, nextStatus)) {
      throw new UnprocessableEntityError(
        `Invalid status transition from "${order.status}" to "${nextStatus}"`,
      );
    }

    const updated = await this.orderRepository.updateStatus(id, nextStatus);
    this.logger.info(
      { orderId: id, from: order.status, to: nextStatus },
      'Order status updated',
    );
    return updated;
  }

  /**
   * Cancel an order. Only permitted while the order is still PENDING; any other
   * state yields a 409 Conflict.
   */
  async cancelOrder(id: string): Promise<OrderWithItems> {
    const order = await this.getOrderById(id);

    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictError(
        `Only PENDING orders can be cancelled; order is "${order.status}"`,
      );
    }

    const cancelled = await this.orderRepository.updateStatus(
      id,
      OrderStatus.CANCELLED,
    );
    this.logger.info({ orderId: id }, 'Order cancelled');
    return cancelled;
  }

  /**
   * Scheduler hook: move every PENDING order to PROCESSING in a single bulk
   * update. Returns the number of orders transitioned.
   */
  async promotePendingOrders(): Promise<number> {
    const count = await this.orderRepository.updateStatusForAll(
      OrderStatus.PENDING,
      OrderStatus.PROCESSING,
    );
    if (count > 0) {
      this.logger.info({ count }, 'Scheduler promoted PENDING orders to PROCESSING');
    }
    return count;
  }
}
