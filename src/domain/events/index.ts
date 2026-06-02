import type { OrderCreated } from "./order-created.js";
import type { OrderStatusChanged } from "./order-status-changed.js";
import type { OrderCancelled } from "./order-cancelled.js";

export type DomainEvent = OrderCreated | OrderStatusChanged | OrderCancelled;
export type { OrderCreated, OrderStatusChanged, OrderCancelled };
