import { Order } from "@/domain/order/order.js";
import { OrderId } from "@/domain/shared/order-id.js";
import { OrderStatus } from "@/domain/order/order-status.js";
import { OrderItem } from "@/domain/order/order-item.js";
import { AddressSnapshot } from "@/domain/order/address-snapshot.js";
import { Coordinates } from "@/domain/shared/coordinates.js";

const addr = AddressSnapshot.of({ street: "S", city: "Manila", country: "PH", coordinates: Coordinates.of(14.5, 121.0) });

export function makeOrder(overrides: Partial<{
  status: OrderStatus; assignedDriverId: string | null; customerId: string;
}> = {}): Order {
  return Order.fromPersistence({
    id: OrderId.generate(),
    customerId: overrides.customerId ?? "cust-1",
    status: overrides.status ?? OrderStatus.CREATED,
    pickup: addr, dropoff: addr, dropoffSourceAddressId: null,
    items: [OrderItem.of({ description: "Parcel", quantity: 1 })],
    assignedDriverId: overrides.assignedDriverId ?? null,
    scheduledFor: null, cancelReason: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
  });
}
