import { Order } from "../../domain/order/order.js";
import { OrderId } from "../../domain/shared/order-id.js";
import { OrderStatus } from "../../domain/order/order-status.js";
import { OrderItem } from "../../domain/order/order-item.js";
import { AddressSnapshot } from "../../domain/order/address-snapshot.js";
import { Coordinates } from "../../domain/shared/coordinates.js";
import { ForbiddenError, UnprocessableEntityError } from "../../domain/shared/errors.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { UserAddressResolver } from "../ports/user-address-resolver.js";
import type { Clock } from "../ports/clock.js";

export interface CreateOrderInput {
  customerId: string;
  pickup: { label?: string; street: string; city: string; country: string; lat: number; lng: number };
  dropoffAddressId: string;
  items: { description: string; quantity: number; weightKg?: number }[];
  scheduledFor: Date | null;
}

export class CreateOrderUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventPublisher,
    private readonly addresses: UserAddressResolver,
    private readonly clock: Clock,
    private readonly idGen: () => string,
  ) {}

  async execute(input: CreateOrderInput, correlationId: string): Promise<{ id: OrderId }> {
    const resolved = await this.addresses.resolve(input.dropoffAddressId, correlationId);
    if (!resolved) throw new UnprocessableEntityError(`dropoff address ${input.dropoffAddressId} not found`);
    if (resolved.userId !== input.customerId) throw new ForbiddenError("dropoff address is not owned by the caller");

    const now = this.clock.now();
    const pickup = AddressSnapshot.of({
      label: input.pickup.label, street: input.pickup.street, city: input.pickup.city,
      country: input.pickup.country, coordinates: Coordinates.of(input.pickup.lat, input.pickup.lng),
    });
    const dropoff = AddressSnapshot.of({
      label: resolved.label, street: resolved.street, city: resolved.city,
      country: resolved.country, coordinates: Coordinates.of(resolved.lat, resolved.lng),
    });
    const items = input.items.map((i) => OrderItem.of(i));
    const order = Order.create({
      id: OrderId.of(this.idGen()),
      customerId: input.customerId,
      pickup, dropoff, dropoffSourceAddressId: resolved.id,
      items, scheduledFor: input.scheduledFor, now,
    });

    await this.uow.run(async (repos) => {
      await repos.orders.save(order);
      await repos.history.record({
        orderId: order.id, fromStatus: null, toStatus: OrderStatus.CREATED,
        reason: null, changedBy: `customer:${input.customerId}`, changedAt: now,
      });
    });
    await this.events.publishAll(order.pullEvents(), correlationId);
    return { id: order.id };
  }
}
