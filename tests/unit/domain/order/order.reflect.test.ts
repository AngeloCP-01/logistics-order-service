import { OrderStatus } from "@/domain/order/order-status.js";
import { makeOrder } from "@tests/unit/domain/order/_order-factory.js";

const now = new Date("2026-06-02T13:00:00Z");

describe("Order.applyReflectedStatus", () => {
  it("advances created -> assigned and sets the driver", () => {
    const order = makeOrder({ status: OrderStatus.CREATED });
    const advanced = order.applyReflectedStatus(OrderStatus.ASSIGNED, "drv-9", now);
    expect(advanced).toBe(true);
    expect(order.status).toBe(OrderStatus.ASSIGNED);
    expect(order.assignedDriverId).toBe("drv-9");
    expect(order.pullEvents()[0].eventType).toBe("order.status.changed");
  });

  it("is a no-op for a lower-or-equal rank (duplicate / out-of-order)", () => {
    const order = makeOrder({ status: OrderStatus.COMPLETED });
    const advanced = order.applyReflectedStatus(OrderStatus.ASSIGNED, "drv-9", now);
    expect(advanced).toBe(false);
    expect(order.status).toBe(OrderStatus.COMPLETED);
    expect(order.pullEvents()).toHaveLength(0);
  });

  it("jumps created -> completed when an out-of-order terminal arrives", () => {
    const order = makeOrder({ status: OrderStatus.CREATED });
    expect(order.applyReflectedStatus(OrderStatus.COMPLETED, null, now)).toBe(true);
    expect(order.status).toBe(OrderStatus.COMPLETED);
  });

  it("never resurrects a cancelled order", () => {
    const order = makeOrder({ status: OrderStatus.CANCELLED });
    expect(order.applyReflectedStatus(OrderStatus.IN_TRANSIT, null, now)).toBe(false);
    expect(order.status).toBe(OrderStatus.CANCELLED);
  });
});
