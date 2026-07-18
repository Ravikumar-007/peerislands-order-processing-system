import type { OrderWithItems } from '../types/order.types';

/**
 * Presentation shape returned to API clients.
 *
 * Prisma models `Decimal` columns as `Decimal` objects. We convert them to plain
 * numbers here so the JSON contract is stable and predictable for consumers.
 */
export interface OrderResponse {
  id: string;
  customerName: string;
  status: string;
  totalAmount: number;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

/** Map a persisted order (with items) to its API representation. */
export function toOrderResponse(order: OrderWithItems): OrderResponse {
  return {
    id: order.id,
    customerName: order.customerName,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      price: Number(item.price),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
