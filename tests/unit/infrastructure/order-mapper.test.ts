import { OrderMapper } from "@/infrastructure/persistence/order-mapper.js";
import { OrderStatus } from "@/domain/order/order-status.js";
import { makeOrder } from "@tests/unit/domain/order/_order-factory.js";

describe("OrderMapper", () => {
  it("maps a domain order to a persistence row and back", () => {
    const order = makeOrder({ status: OrderStatus.ASSIGNED, assignedDriverId: "drv-1" });
    const row = OrderMapper.toPersistence(order);
    expect(row.order.status).toBe("assigned");
    expect((row.order.pickupAddress as { street: string }).street).toBe("S");
    const back = OrderMapper.toDomain({ ...row.order, items: row.items });
    expect(back.status).toBe(OrderStatus.ASSIGNED);
    expect(back.assignedDriverId).toBe("drv-1");
    expect(back.pickup.country).toBe("PH");
  });
});
