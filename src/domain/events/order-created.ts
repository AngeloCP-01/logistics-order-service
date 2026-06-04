import type { OrderId } from "../shared/order-id.js";
import type { AddressSnapshot } from "../order/address-snapshot.js";
import type { OrderItem } from "../order/order-item.js";

export class OrderCreated {
  readonly eventType = "order.created" as const;
  constructor(
    readonly orderId: OrderId,
    readonly customerId: string,
    readonly pickup: AddressSnapshot,
    readonly dropoff: AddressSnapshot,
    readonly items: readonly OrderItem[],
    readonly scheduledFor: Date | null,
    readonly occurredAt: Date,
  ) {}
}
