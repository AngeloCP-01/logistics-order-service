import type { Request, Response, NextFunction } from "express";
import { OrderId } from "../../../domain/shared/order-id.js";
import { createOrderSchema, cancelOrderSchema, listQuerySchema, adminListQuerySchema } from "../schemas.js";
import { toOrderResponse } from "../response-mappers.js";
import type { CreateOrderInput, CreateOrderUseCase } from "../../../application/orders/create-order.use-case.js";
import type { CancelOrderUseCase } from "../../../application/orders/cancel-order.use-case.js";
import type { GetOrderUseCase } from "../../../application/orders/get-order.use-case.js";
import type { ListMyOrdersInput, ListMyOrdersUseCase } from "../../../application/orders/list-my-orders.use-case.js";
import type { ListOrdersInput, ListOrdersUseCase } from "../../../application/orders/list-orders.use-case.js";

export class OrderController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly cancelOrder: CancelOrderUseCase,
    private readonly getOrder: GetOrderUseCase,
    private readonly listMyOrders: ListMyOrdersUseCase,
    private readonly listAll: ListOrdersUseCase,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createOrderSchema.parse(req.body);
      const pickup: CreateOrderInput["pickup"] = {
        ...(body.pickup.label !== undefined ? { label: body.pickup.label } : {}),
        street: body.pickup.street,
        city: body.pickup.city,
        country: body.pickup.country,
        lat: body.pickup.lat,
        lng: body.pickup.lng,
      };
      const items: CreateOrderInput["items"] = body.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        ...(i.weightKg !== undefined ? { weightKg: i.weightKg } : {}),
      }));
      const { id } = await this.createOrder.execute(
        {
          customerId: req.userId!,
          pickup,
          dropoffAddressId: body.dropoffAddressId,
          items,
          scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        },
        req.requestId!,
      );
      const order = await this.getOrder.execute({ orderId: id, caller: { id: req.userId!, role: req.role! } });
      res.status(201).location(`/orders/${id}`).json(toOrderResponse(order));
    } catch (e) {
      next(e);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = cancelOrderSchema.parse(req.body ?? {});
      await this.cancelOrder.execute(
        {
          orderId: OrderId.of(req.params.id),
          actor: { role: req.role!, id: req.userId! },
          reason: body.reason ?? null,
        },
        req.requestId!,
      );
      const order = await this.getOrder.execute({
        orderId: OrderId.of(req.params.id),
        caller: { id: req.userId!, role: req.role! },
      });
      res.status(200).json(toOrderResponse(order));
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await this.getOrder.execute({
        orderId: OrderId.of(req.params.id),
        caller: { id: req.userId!, role: req.role! },
      });
      res.status(200).json(toOrderResponse(order));
    } catch (e) {
      next(e);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = listQuerySchema.parse(req.query);
      const input: ListMyOrdersInput = {
        customerId: req.userId!,
        cursor: q.cursor ?? null,
        limit: q.limit,
        ...(q.status !== undefined ? { status: q.status } : {}),
      };
      const page = await this.listMyOrders.execute(input);
      res.status(200).json({ items: page.items.map(toOrderResponse), nextCursor: page.nextCursor });
    } catch (e) {
      next(e);
    }
  };

  listAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = adminListQuerySchema.parse(req.query);
      const input: ListOrdersInput = {
        cursor: q.cursor ?? null,
        limit: q.limit,
        ...(q.status !== undefined ? { status: q.status } : {}),
        ...(q.customerId !== undefined ? { customerId: q.customerId } : {}),
      };
      const page = await this.listAll.execute(input);
      res.status(200).json({ items: page.items.map(toOrderResponse), nextCursor: page.nextCursor });
    } catch (e) {
      next(e);
    }
  };
}
