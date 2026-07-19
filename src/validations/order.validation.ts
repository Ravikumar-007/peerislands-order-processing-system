import { z } from 'zod';
import { OrderStatus } from '../types/order.types';

/** A single order line item. Quantities and prices are strictly validated. */
const orderItemSchema = z.object({
  productName: z.string().trim().min(1, 'productName is required').max(255),
  quantity: z
    .number({ invalid_type_error: 'quantity must be a number' })
    .int('quantity must be an integer')
    .positive('quantity must be greater than 0'),
  price: z
    .number({ invalid_type_error: 'price must be a number' })
    .positive('price must be greater than 0')
    .max(1_000_000, 'price is unrealistically large'),
});

/** Body schema for POST /orders. */
export const createOrderSchema = z.object({
  body: z.object({
    customerName: z.string().trim().min(1, 'customerName is required').max(255),
    items: z
      .array(orderItemSchema)
      .min(1, 'an order must contain at least one item')
      .max(100, 'an order cannot contain more than 100 items'),
  }),
});

/** Params schema for routes that take an :id. */
export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('id must be a valid UUID'),
  }),
});

/** Body schema for PATCH /orders/:id/status. */
export const updateStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('id must be a valid UUID'),
  }),
  body: z.object({
    status: z.nativeEnum(OrderStatus, {
      errorMap: () => ({ message: 'status must be a valid OrderStatus' }),
    }),
  }),
});

/** Query schema for GET /orders (filtering, pagination, sorting). */
export const listOrdersSchema = z.object({
  query: z.object({
    status: z.nativeEnum(OrderStatus).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>['body'];
export type ListOrdersQuery = z.infer<typeof listOrdersSchema>['query'];
