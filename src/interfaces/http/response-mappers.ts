import type { Order } from "../../domain/order/order.js";

export function toOrderResponse(order: Order): Record<string, unknown> {
  const addr = (a: Order["pickup"]) => ({
    label: a.label,
    street: a.street,
    city: a.city,
    country: a.country,
    lat: a.coordinates.lat,
    lng: a.coordinates.lng,
  });
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status,
    pickup: addr(order.pickup),
    dropoff: addr(order.dropoff),
    items: order.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      weightKg: i.weightKg ?? null,
    })),
    assignedDriverId: order.assignedDriverId,
    scheduledFor: order.scheduledFor ? order.scheduledFor.toISOString() : null,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
