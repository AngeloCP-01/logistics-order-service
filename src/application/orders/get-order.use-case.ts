import type { Order } from "../../domain/order/order.js";
import type { OrderId } from "../../domain/shared/order-id.js";
import type { OrderRepository } from "../../domain/order/order-repository.js";
import { OrderNotFoundError } from "../../domain/shared/errors.js";

export interface GetOrderInput {
  orderId: OrderId;
  caller: { id: string; role: "customer" | "driver" | "admin" };
}

export class GetOrderUseCase {
  constructor(private readonly orders: OrderRepository) {}

  async execute(input: GetOrderInput): Promise<Order> {
    const order = await this.orders.byId(input.orderId);
    if (!order || (order.customerId !== input.caller.id && input.caller.role !== "admin")) {
      throw new OrderNotFoundError(String(input.orderId));
    }
    return order;
  }
}
