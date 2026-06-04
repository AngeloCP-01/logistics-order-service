import type { OrderRepository, OrderPage } from "../../domain/order/order-repository.js";
import type { OrderStatus } from "../../domain/order/order-status.js";

export interface ListMyOrdersInput {
  customerId: string;
  cursor: string | null;
  limit: number;
  status?: OrderStatus;
}

export class ListMyOrdersUseCase {
  constructor(private readonly orders: OrderRepository) {}

  execute(input: ListMyOrdersInput): Promise<OrderPage> {
    return this.orders.pageByCustomer(input.customerId, {
      cursor: input.cursor,
      limit: input.limit,
      status: input.status,
    });
  }
}
