import { CancelOrderUseCase } from "@/application/orders/cancel-order.use-case.js";
import { OrderStatus } from "@/domain/order/order-status.js";
import { OrderNotFoundError } from "@/domain/shared/errors.js";
import {
  FakeOrderRepository, FakeHistoryRepository, FakeProcessedEventRepository,
  FakeUnitOfWork, FakeEventPublisher, FixedClock,
} from "@tests/unit/application/_fakes.js";
import { makeOrder } from "@tests/unit/domain/order/_order-factory.js";

const NOW = new Date("2026-06-02T12:00:00Z");

function build() {
  const orders = new FakeOrderRepository();
  const history = new FakeHistoryRepository();
  const uow = new FakeUnitOfWork(orders, history, new FakeProcessedEventRepository());
  const publisher = new FakeEventPublisher();
  const sut = new CancelOrderUseCase(uow, publisher, new FixedClock(NOW));
  return { sut, orders, history, publisher };
}

describe("CancelOrderUseCase", () => {
  it("lets the owner cancel a created order and publishes order.cancelled", async () => {
    const { sut, orders, publisher } = build();
    const order = makeOrder({ status: OrderStatus.CREATED, customerId: "cust-1" });
    await orders.save(order);
    await sut.execute({ orderId: order.id, actor: { role: "customer", id: "cust-1" }, reason: "no" }, "c");
    expect(orders.store.get(order.id)!.status).toBe(OrderStatus.CANCELLED);
    expect(publisher.published[0].eventType).toBe("order.cancelled");
  });

  it("returns 404 to a non-owner non-admin (existence-hiding)", async () => {
    const { sut, orders } = build();
    const order = makeOrder({ status: OrderStatus.CREATED, customerId: "cust-1" });
    await orders.save(order);
    await expect(sut.execute({ orderId: order.id, actor: { role: "customer", id: "intruder" }, reason: null }, "c"))
      .rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it("returns 404 for an unknown order", async () => {
    const { sut } = build();
    await expect(sut.execute({ orderId: "44444444-4444-7444-8444-444444444444" as never, actor: { role: "admin", id: "a" }, reason: null }, "c"))
      .rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it("lets an admin cancel an in_transit order with a reason", async () => {
    const { sut, orders } = build();
    const order = makeOrder({ status: OrderStatus.IN_TRANSIT, customerId: "cust-1" });
    await orders.save(order);
    await sut.execute({ orderId: order.id, actor: { role: "admin", id: "adm" }, reason: "accident" }, "c");
    expect(orders.store.get(order.id)!.status).toBe(OrderStatus.CANCELLED);
  });
});
