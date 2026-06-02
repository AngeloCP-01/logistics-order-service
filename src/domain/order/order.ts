import type { OrderId } from "../shared/order-id.js";
import { OrderStatus } from "./order-status.js";
import type { OrderItem } from "./order-item.js";
import type { AddressSnapshot } from "./address-snapshot.js";
import { InvariantViolationError } from "../shared/errors.js";
import { OrderCreated } from "../events/order-created.js";
import type { DomainEvent } from "../events/index.js";

export interface CreateOrderArgs {
  id: OrderId;
  customerId: string;
  pickup: AddressSnapshot;
  dropoff: AddressSnapshot;
  dropoffSourceAddressId: string | null;
  items: OrderItem[];
  scheduledFor: Date | null;
  now: Date;
}

export class Order {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: OrderId,
    readonly customerId: string,
    private _status: OrderStatus,
    readonly pickup: AddressSnapshot,
    readonly dropoff: AddressSnapshot,
    readonly dropoffSourceAddressId: string | null,
    readonly items: readonly OrderItem[],
    private _assignedDriverId: string | null,
    readonly scheduledFor: Date | null,
    private _cancelReason: string | null,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  get status(): OrderStatus { return this._status; }
  get assignedDriverId(): string | null { return this._assignedDriverId; }
  get cancelReason(): string | null { return this._cancelReason; }
  get updatedAt(): Date { return this._updatedAt; }

  static create(args: CreateOrderArgs): Order {
    if (args.items.length < 1) throw new InvariantViolationError("an order must have at least one item");
    if (args.scheduledFor !== null && args.scheduledFor.getTime() <= args.now.getTime()) {
      throw new InvariantViolationError("scheduledFor must be in the future");
    }
    const order = new Order(
      args.id, args.customerId, OrderStatus.CREATED, args.pickup, args.dropoff,
      args.dropoffSourceAddressId, [...args.items], null, args.scheduledFor, null,
      args.now, args.now,
    );
    order.events.push(new OrderCreated(
      args.id, args.customerId, args.pickup, args.dropoff, [...args.items], args.scheduledFor, args.now,
    ));
    return order;
  }

  pullEvents(): DomainEvent[] { return this.events.splice(0); }
}
