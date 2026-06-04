import type { OrderId } from "../shared/order-id.js";
import type { OrderStatus } from "../order/order-status.js";

export class OrderCancelled {
  readonly eventType = "order.cancelled" as const;
  constructor(
    readonly orderId: OrderId,
    readonly customerId: string,
    readonly previousStatus: OrderStatus,
    readonly reason: string | null,
    readonly occurredAt: Date,
  ) {}
}
