import type { OrderId } from "../shared/order-id.js";
import type { OrderStatus } from "../order/order-status.js";

export class OrderStatusChanged {
  readonly eventType = "order.status.changed" as const;
  constructor(
    readonly orderId: OrderId,
    readonly fromStatus: OrderStatus | null,
    readonly toStatus: OrderStatus,
    readonly changedBy: string,
    readonly occurredAt: Date,
  ) {}
}
