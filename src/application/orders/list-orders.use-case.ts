import type { OrderRepository, OrderPage } from "../../domain/order/order-repository.js";
import type { OrderStatus } from "../../domain/order/order-status.js";

export interface ListOrdersInput {
  cursor: string | null;
  limit: number;
  status?: OrderStatus;
  customerId?: string;
}

export class ListOrdersUseCase {
  constructor(private readonly orders: OrderRepository) {}

  execute(input: ListOrdersInput): Promise<OrderPage> {
    return this.orders.page({
      cursor: input.cursor,
      limit: input.limit,
      status: input.status,
      customerId: input.customerId,
    });
  }
}
