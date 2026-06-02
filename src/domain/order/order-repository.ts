import type { Order } from "./order.js";
import type { OrderId } from "../shared/order-id.js";
import type { OrderStatus } from "./order-status.js";

export interface OrderPage { items: Order[]; nextCursor: string | null; }
export interface PageQuery { cursor: string | null; limit: number; status?: OrderStatus | undefined; }

export interface OrderRepository {
  byId(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
  pageByCustomer(customerId: string, q: PageQuery): Promise<OrderPage>;
  page(q: PageQuery & { customerId?: string | undefined }): Promise<OrderPage>;
}

export interface StatusHistoryEntry {
  id: string; orderId: string; fromStatus: OrderStatus | null;
  toStatus: OrderStatus; reason: string | null; changedBy: string; changedAt: Date;
}

export type NewStatusHistoryEntry = Omit<StatusHistoryEntry, "id">;

export interface OrderStatusHistoryRepository {
  record(entry: NewStatusHistoryEntry): Promise<void>;
}
