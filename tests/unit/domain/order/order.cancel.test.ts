import { OrderStatus } from "@/domain/order/order-status.js";
import { InvalidOrderTransitionError, ForbiddenError, ValidationError } from "@/domain/shared/errors.js";
import { makeOrder } from "@tests/unit/domain/order/_order-factory.js";

describe("Order.cancel", () => {
  const customer = { role: "customer" as const, id: "cust-1" };
  const admin = { role: "admin" as const, id: "adm-1" };
  const now = new Date("2026-06-02T12:00:00Z");

  it("cancels a created order by the customer", () => {
    const order = makeOrder({ status: OrderStatus.CREATED });
    order.cancel(customer, "changed my mind", now);
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(order.cancelReason).toBe("changed my mind");
    const ev = order.pullEvents();
    expect(ev[0].eventType).toBe("order.cancelled");
  });

  it("cancels an assigned order by the customer", () => {
    const order = makeOrder({ status: OrderStatus.ASSIGNED, assignedDriverId: "drv-1" });
    order.cancel(customer, null, now);
    expect(order.status).toBe(OrderStatus.CANCELLED);
  });

  it("forbids a customer cancelling an in_transit order", () => {
    const order = makeOrder({ status: OrderStatus.IN_TRANSIT });
    expect(() => order.cancel(customer, "x", now)).toThrow(ForbiddenError);
  });

  it("requires a reason when admin cancels an in_transit order", () => {
    const order = makeOrder({ status: OrderStatus.IN_TRANSIT });
    expect(() => order.cancel(admin, null, now)).toThrow(ValidationError);
  });

  it("admin cancels an in_transit order with a reason", () => {
    const order = makeOrder({ status: OrderStatus.IN_TRANSIT });
    order.cancel(admin, "accident", now);
    expect(order.status).toBe(OrderStatus.CANCELLED);
  });

  it("rejects cancelling a completed order", () => {
    const order = makeOrder({ status: OrderStatus.COMPLETED });
    expect(() => order.cancel(admin, "x", now)).toThrow(InvalidOrderTransitionError);
  });

  it("rejects cancelling an already-cancelled order", () => {
    const order = makeOrder({ status: OrderStatus.CANCELLED });
    expect(() => order.cancel(admin, "x", now)).toThrow(InvalidOrderTransitionError);
  });
});
