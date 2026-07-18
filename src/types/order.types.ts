import type { Order, OrderItem, OrderStatus } from '@prisma/client';

/** Re-export the Prisma-generated enum so the rest of the app has one source of truth. */
export { OrderStatus } from '@prisma/client';

/** Input for creating a single order line item. */
export interface CreateOrderItemInput {
  productName: string;
  quantity: number;
  price: number;
}

/** Input for creating an order (already validated by Zod). */
export interface CreateOrderInput {
  customerName: string;
  items: CreateOrderItemInput[];
}

/** Options for listing orders (filtering, pagination, sorting). */
export interface ListOrdersOptions {
  status?: OrderStatus;
  page: number;
  limit: number;
  sortOrder: 'asc' | 'desc';
}

/** An order together with its items, as returned by the repository. */
export type OrderWithItems = Order & { items: OrderItem[] };

/** Paginated result envelope. */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
