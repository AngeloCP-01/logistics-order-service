export const OrderStatus = {
  CREATED: "created",
  ASSIGNED: "assigned",
  IN_TRANSIT: "in_transit",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

const RANK: Record<OrderStatus, number> = {
  created: 0,
  assigned: 1,
  in_transit: 2,
  completed: 3,
  cancelled: -1,
};

export function rankOf(s: OrderStatus): number {
  return RANK[s];
}

export function isTerminal(s: OrderStatus): boolean {
  return s === OrderStatus.COMPLETED || s === OrderStatus.CANCELLED;
}
