import { Router } from 'express';
import type { OrderController } from '../controllers/order.controller';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createOrderSchema,
  listOrdersSchema,
  orderIdParamSchema,
  updateStatusSchema,
} from '../validations/order.validation';

/**
 * @openapi
 * tags:
 *   - name: Orders
 *     description: Order management endpoints
 */
export function createOrderRouter(controller: OrderController): Router {
  const router = Router();

  /**
   * @openapi
   * /orders:
   *   post:
   *     summary: Create a new order
   *     tags: [Orders]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateOrderRequest'
   *     responses:
   *       201:
   *         description: Order created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Order'
   *       400:
   *         description: Validation error
   */
  router.post(
    '/',
    validate(createOrderSchema),
    asyncHandler(controller.createOrder),
  );

  /**
   * @openapi
   * /orders:
   *   get:
   *     summary: List orders with filtering, pagination and sorting
   *     tags: [Orders]
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           $ref: '#/components/schemas/OrderStatus'
   *       - in: query
   *         name: page
   *         schema: { type: integer, minimum: 1, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
   *       - in: query
   *         name: sortOrder
   *         schema: { type: string, enum: [asc, desc], default: desc }
   *     responses:
   *       200:
   *         description: Paginated list of orders
   */
  router.get(
    '/',
    validate(listOrdersSchema),
    asyncHandler(controller.listOrders),
  );

  /**
   * @openapi
   * /orders/{id}:
   *   get:
   *     summary: Retrieve an order by id
   *     tags: [Orders]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: The order
   *       404:
   *         description: Order not found
   */
  router.get(
    '/:id',
    validate(orderIdParamSchema),
    asyncHandler(controller.getOrderById),
  );

  /**
   * @openapi
   * /orders/{id}/status:
   *   patch:
   *     summary: Update an order's status (enforces the state machine)
   *     tags: [Orders]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status:
   *                 $ref: '#/components/schemas/OrderStatus'
   *     responses:
   *       200:
   *         description: Updated order
   *       409:
   *         description: Order already in the target status
   *       422:
   *         description: Invalid status transition
   */
  router.patch(
    '/:id/status',
    validate(updateStatusSchema),
    asyncHandler(controller.updateOrderStatus),
  );

  /**
   * @openapi
   * /orders/{id}/cancel:
   *   post:
   *     summary: Cancel an order (only allowed while PENDING)
   *     tags: [Orders]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Cancelled order
   *       409:
   *         description: Order is not in a cancellable state
   */
  router.post(
    '/:id/cancel',
    validate(orderIdParamSchema),
    asyncHandler(controller.cancelOrder),
  );

  return router;
}
