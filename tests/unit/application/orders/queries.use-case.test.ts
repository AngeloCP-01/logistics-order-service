import { GetOrderUseCase } from "@/application/orders/get-order.use-case.js";
import { ListMyOrdersUseCase } from "@/application/orders/list-my-orders.use-case.js";
import { OrderStatus } from "@/domain/order/order-status.js";
import { OrderNotFoundError } from "@/domain/shared/errors.js";
import { FakeOrderRepository } from "@tests/unit/application/_fakes.js";
import { makeOrder } from "@tests/unit/domain/order/_order-factory.js";

describe("GetOrderUseCase", () => {
  it("returns the order to its owner", async () => {
    const orders = new FakeOrderRepository();
    const order = makeOrder({ status: OrderStatus.CREATED, customerId: "cust-1" });
    await orders.save(order);
    const sut = new GetOrderUseCase(orders);
    const got = await sut.execute({ orderId: order.id, caller: { id: "cust-1", role: "customer" } });
    expect(got.id).toBe(order.id);
  });
  it("hides another customer's order behind 404", async () => {
    const orders = new FakeOrderRepository();
    const order = makeOrder({ status: OrderStatus.CREATED, customerId: "cust-1" });
    await orders.save(order);
    const sut = new GetOrderUseCase(orders);
    await expect(sut.execute({ orderId: order.id, caller: { id: "other", role: "customer" } }))
      .rejects.toBeInstanceOf(OrderNotFoundError);
  });
  it("lets an admin read any order", async () => {
    const orders = new FakeOrderRepository();
    const order = makeOrder({ status: OrderStatus.CREATED, customerId: "cust-1" });
    await orders.save(order);
    const sut = new GetOrderUseCase(orders);
    expect((await sut.execute({ orderId: order.id, caller: { id: "adm", role: "admin" } })).id).toBe(order.id);
  });
});

describe("ListMyOrdersUseCase", () => {
  it("returns only the caller's orders", async () => {
    const orders = new FakeOrderRepository();
    await orders.save(makeOrder({ customerId: "cust-1" }));
    await orders.save(makeOrder({ customerId: "cust-2" }));
    const sut = new ListMyOrdersUseCase(orders);
    const page = await sut.execute({ customerId: "cust-1", cursor: null, limit: 20 });
    expect(page.items).toHaveLength(1);
  });
});
