import type { OrderId } from "../../domain/shared/order-id.js";
import type { OrderStatus } from "../../domain/order/order-status.js";
import { OrderNotFoundError } from "../../domain/shared/errors.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { Clock } from "../ports/clock.js";

export interface ReflectInput {
  eventId: string;
  eventType: string;          // dispatch.driver.assigned | delivery.in_transit | delivery.completed
  orderId: OrderId;
  target: OrderStatus;
  driverId: string | null;
}

export class ReflectOrderStatusUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: ReflectInput, correlationId: string): Promise<void> {
    const now = this.clock.now();
    const result = await this.uow.run(async (repos) => {
      const order = await repos.orders.byId(input.orderId);
      if (!order) throw new OrderNotFoundError(String(input.orderId)); // retryable — create may be in flight
      const isNew = await repos.processedEvents.recordIfNew(input.eventId, input.eventType);
      if (!isNew) return null;                                          // duplicate → ack, no publish
      const from = order.status;
      const advanced = order.applyReflectedStatus(input.target, input.driverId, now);
      if (!advanced) return null;
      await repos.orders.save(order);
      await repos.history.record({
        orderId: order.id, fromStatus: from, toStatus: order.status,
        reason: null, changedBy: `system:${input.eventType}`, changedAt: now,
      });
      return order;
    });
    if (result) await this.events.publishAll(result.pullEvents(), correlationId);
  }
}
