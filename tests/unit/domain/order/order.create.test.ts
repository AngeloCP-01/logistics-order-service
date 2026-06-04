import { Order } from "@/domain/order/order.js";
import { OrderId } from "@/domain/shared/order-id.js";
import { OrderStatus } from "@/domain/order/order-status.js";
import { OrderItem } from "@/domain/order/order-item.js";
import { AddressSnapshot } from "@/domain/order/address-snapshot.js";
import { Coordinates } from "@/domain/shared/coordinates.js";
import { InvariantViolationError } from "@/domain/shared/errors.js";

const addr = (s: string) => AddressSnapshot.of({ street: s, city: "Manila", country: "PH", coordinates: Coordinates.of(14.5, 121.0) });
const baseArgs = () => ({
  id: OrderId.generate(),
  customerId: "11111111-1111-7111-8111-111111111111",
  pickup: addr("Pickup St"),
  dropoff: addr("Dropoff St"),
  dropoffSourceAddressId: "22222222-2222-7222-8222-222222222222",
  items: [OrderItem.of({ description: "Parcel", quantity: 1 })],
  scheduledFor: null as Date | null,
  now: new Date("2026-06-02T10:00:00Z"),
});

describe("Order.create", () => {
  it("creates an order in CREATED status", () => {
    const order = Order.create(baseArgs());
    expect(order.status).toBe(OrderStatus.CREATED);
    expect(order.assignedDriverId).toBeNull();
  });
  it("records an OrderCreated event", () => {
    const order = Order.create(baseArgs());
    const events = order.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("order.created");
  });
  it("requires at least one item", () => {
    expect(() => Order.create({ ...baseArgs(), items: [] })).toThrow(InvariantViolationError);
  });
  it("rejects a past scheduledFor", () => {
    expect(() => Order.create({ ...baseArgs(), scheduledFor: new Date("2026-06-01T10:00:00Z") }))
      .toThrow(InvariantViolationError);
  });
  it("accepts a future scheduledFor", () => {
    const order = Order.create({ ...baseArgs(), scheduledFor: new Date("2026-06-10T10:00:00Z") });
    expect(order.scheduledFor?.toISOString()).toBe("2026-06-10T10:00:00.000Z");
  });
});
