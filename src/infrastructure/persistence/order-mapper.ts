import { Order } from "../../domain/order/order.js";
import { OrderId } from "../../domain/shared/order-id.js";
import type { OrderStatus } from "../../domain/order/order-status.js";
import { OrderItem } from "../../domain/order/order-item.js";
import { AddressSnapshot } from "../../domain/order/address-snapshot.js";
import { Coordinates } from "../../domain/shared/coordinates.js";

interface AddressJson { label?: string; street: string; city: string; country: string; lat: number; lng: number; }

export interface OrderRow {
  id: string; customerId: string; status: string;
  pickupAddress: unknown; dropoffAddress: unknown;
  dropoffSourceAddressId: string | null; assignedDriverId: string | null;
  scheduledFor: Date | null; cancelReason: string | null;
  createdAt: Date; updatedAt: Date;
}
export interface ItemRow { id: string; orderId: string; description: string; quantity: number; weightKg: unknown | null; }

function toSnapshot(json: unknown): AddressSnapshot {
  const a = json as AddressJson;
  return AddressSnapshot.of({
    label: a.label, street: a.street, city: a.city, country: a.country,
    coordinates: Coordinates.of(Number(a.lat), Number(a.lng)),
  });
}

export const OrderMapper = {
  toPersistence(order: Order): { order: OrderRow; items: Omit<ItemRow, "orderId">[] } {
    return {
      order: {
        id: order.id, customerId: order.customerId, status: order.status,
        pickupAddress: order.pickup.toJSON(), dropoffAddress: order.dropoff.toJSON(),
        dropoffSourceAddressId: order.dropoffSourceAddressId, assignedDriverId: order.assignedDriverId,
        scheduledFor: order.scheduledFor, cancelReason: order.cancelReason,
        createdAt: order.createdAt, updatedAt: order.updatedAt,
      },
      items: order.items.map((i) => ({
        id: cryptoRandom(), description: i.description, quantity: i.quantity,
        weightKg: i.weightKg ?? null,
      })),
    };
  },

  toDomain(row: OrderRow & { items: Omit<ItemRow, "orderId">[] }): Order {
    return Order.fromPersistence({
      id: OrderId.of(row.id), customerId: row.customerId, status: row.status as OrderStatus,
      pickup: toSnapshot(row.pickupAddress), dropoff: toSnapshot(row.dropoffAddress),
      dropoffSourceAddressId: row.dropoffSourceAddressId,
      items: row.items.map((i) => OrderItem.of({
        description: i.description, quantity: i.quantity,
        weightKg: i.weightKg === null ? undefined : Number(i.weightKg),
      })),
      assignedDriverId: row.assignedDriverId, scheduledFor: row.scheduledFor,
      cancelReason: row.cancelReason, createdAt: row.createdAt, updatedAt: row.updatedAt,
    });
  },
};

function cryptoRandom(): string { return crypto.randomUUID(); }
