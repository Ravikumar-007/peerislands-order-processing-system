import { OrderStatus } from '../types/order.types';

/**
 * Allowed forward status transitions for an order.
 *
 * Cancellation is handled separately (only from PENDING) because it is a
 * distinct business operation, not a linear step in the fulfilment flow.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.PROCESSING],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/** Pure predicate: is moving from `current` to `next` a valid transition? */
export function isValidTransition(
  current: OrderStatus,
  next: OrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[current].includes(next);
}
