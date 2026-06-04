import type { OrderId } from "../../domain/shared/order-id.js";
import type { CancellationActor } from "../../domain/order/order.js";
import { OrderNotFoundError } from "../../domain/shared/errors.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { Clock } from "../ports/clock.js";

export interface CancelOrderInput {
  orderId: OrderId;
  actor: CancellationActor;
  reason: string | null;
}

export class CancelOrderUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: CancelOrderInput, correlationId: string): Promise<void> {
    const now = this.clock.now();
    const order = await this.uow.run(async (repos) => {
      const order = await repos.orders.byId(input.orderId);
      // existence-hiding: a non-owner non-admin sees 404, same as GET
      if (!order || (order.customerId !== input.actor.id && input.actor.role !== "admin")) {
        throw new OrderNotFoundError(String(input.orderId));
      }
      const from = order.status;
      order.cancel(input.actor, input.reason, now);   // throws on illegal state / forbidden / missing reason
      await repos.orders.save(order);
      await repos.history.record({
        orderId: order.id, fromStatus: from, toStatus: order.status,
        reason: order.cancelReason, changedBy: `${input.actor.role}:${input.actor.id}`, changedAt: now,
      });
      return order;
    });
    await this.events.publishAll(order.pullEvents(), correlationId);
  }
}
