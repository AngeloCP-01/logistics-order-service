import { ReflectOrderStatusUseCase } from "@/application/events/reflect-order-status.use-case.js";
import { OrderStatus } from "@/domain/order/order-status.js";
import { OrderNotFoundError } from "@/domain/shared/errors.js";
import {
  FakeOrderRepository, FakeHistoryRepository, FakeProcessedEventRepository,
  FakeUnitOfWork, FakeEventPublisher, FixedClock,
} from "@tests/unit/application/_fakes.js";
import { makeOrder } from "@tests/unit/domain/order/_order-factory.js";

const NOW = new Date("2026-06-02T13:00:00Z");

function build() {
  const orders = new FakeOrderRepository();
  const history = new FakeHistoryRepository();
  const processed = new FakeProcessedEventRepository();
  const uow = new FakeUnitOfWork(orders, history, processed);
  const publisher = new FakeEventPublisher();
  const sut = new ReflectOrderStatusUseCase(uow, publisher, new FixedClock(NOW));
  return { sut, orders, publisher, processed };
}

describe("ReflectOrderStatusUseCase", () => {
  it("advances on dispatch.driver.assigned and publishes order.status.changed", async () => {
    const { sut, orders, publisher } = build();
    const order = makeOrder({ status: OrderStatus.CREATED });
    await orders.save(order);
    await sut.execute({
      eventId: "e1", eventType: "dispatch.driver.assigned",
      orderId: order.id, target: OrderStatus.ASSIGNED, driverId: "drv-1",
    }, "corr");
    expect(orders.store.get(order.id)!.status).toBe(OrderStatus.ASSIGNED);
    expect(orders.store.get(order.id)!.assignedDriverId).toBe("drv-1");
    expect(publisher.published[0].eventType).toBe("order.status.changed");
  });

  it("is idempotent on a duplicate eventId (no second publish)", async () => {
    const { sut, orders, publisher } = build();
    const order = makeOrder({ status: OrderStatus.CREATED });
    await orders.save(order);
    const ev = { eventId: "dup", eventType: "delivery.completed", orderId: order.id, target: OrderStatus.COMPLETED, driverId: null };
    await sut.execute(ev, "c");
    await sut.execute(ev, "c");
    expect(publisher.published).toHaveLength(1);
  });

  it("no-ops an out-of-order lower-rank event", async () => {
    const { sut, orders, publisher } = build();
    const order = makeOrder({ status: OrderStatus.COMPLETED });
    await orders.save(order);
    await sut.execute({ eventId: "e2", eventType: "dispatch.driver.assigned", orderId: order.id, target: OrderStatus.ASSIGNED, driverId: "d" }, "c");
    expect(orders.store.get(order.id)!.status).toBe(OrderStatus.COMPLETED);
    expect(publisher.published).toHaveLength(0);
  });

  it("never resurrects a cancelled order", async () => {
    const { sut, orders } = build();
    const order = makeOrder({ status: OrderStatus.CANCELLED });
    await orders.save(order);
    await sut.execute({ eventId: "e3", eventType: "delivery.in_transit", orderId: order.id, target: OrderStatus.IN_TRANSIT, driverId: null }, "c");
    expect(orders.store.get(order.id)!.status).toBe(OrderStatus.CANCELLED);
  });

  it("throws OrderNotFoundError (retryable) for an unknown order", async () => {
    const { sut } = build();
    await expect(sut.execute({ eventId: "e4", eventType: "delivery.completed", orderId: "missing" as never, target: OrderStatus.COMPLETED, driverId: null }, "c"))
      .rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
