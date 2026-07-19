import type { Request, Response } from 'express';
import type { OrderService } from '../services/order.service';
import { toOrderResponse } from '../utils/orderPresenter';
import type { ListOrdersOptions, OrderStatus } from '../types/order.types';

/**
 * HTTP adapter for orders. Controllers are intentionally thin: they translate
 * between HTTP and the service layer and contain no business logic. Input has
 * already been validated and coerced by the `validate` middleware.
 */
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  createOrder = async (req: Request, res: Response): Promise<void> => {
    const order = await this.orderService.createOrder(req.body);
    res.status(201).json(toOrderResponse(order));
  };

  getOrderById = async (req: Request, res: Response): Promise<void> => {
    const order = await this.orderService.getOrderById(req.params.id);
    res.status(200).json(toOrderResponse(order));
  };

  listOrders = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as {
      status?: OrderStatus;
      page: number;
      limit: number;
      sortOrder: 'asc' | 'desc';
    };
    const options: ListOrdersOptions = {
      status: query.status,
      page: query.page,
      limit: query.limit,
      sortOrder: query.sortOrder,
    };
    const result = await this.orderService.listOrders(options);
    res.status(200).json({
      data: result.data.map(toOrderResponse),
      pagination: result.pagination,
    });
  };

  updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
    const order = await this.orderService.updateOrderStatus(
      req.params.id,
      req.body.status as OrderStatus,
    );
    res.status(200).json(toOrderResponse(order));
  };

  cancelOrder = async (req: Request, res: Response): Promise<void> => {
    const order = await this.orderService.cancelOrder(req.params.id);
    res.status(200).json(toOrderResponse(order));
  };
}
