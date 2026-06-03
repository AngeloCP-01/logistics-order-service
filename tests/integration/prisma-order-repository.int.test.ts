import { v7 as uuidV7 } from "uuid";

import { PrismaOrderRepository } from "@/infrastructure/persistence/prisma-order-repository.js";
import { OrderStatus } from "@/domain/order/order-status.js";
import { makeOrder } from "@tests/unit/domain/order/_order-factory.js";
import { withTestDb } from "@tests/integration/helpers/test-db.js";

// customer_id / assigned_driver_id are `@db.Uuid` columns, so the integration
// fixtures must use real UUIDs (the unit fakes can use "cust-1"/"drv-1" because
// they never touch Postgres).
describe("PrismaOrderRepository (integration)", () => {
  it("saves and reloads an order with items", withTestDb(async (prisma) => {
    const repo = new PrismaOrderRepository(prisma);
    const order = makeOrder({ status: OrderStatus.CREATED, customerId: uuidV7() });
    await repo.save(order);
    const back = await repo.byId(order.id);
    expect(back?.status).toBe(OrderStatus.CREATED);
    expect(back?.items).toHaveLength(1);
    expect(back?.pickup.country).toBe("PH");
  }), 120000);

  it("upsert on a status change preserves items and addresses", withTestDb(async (prisma) => {
    const repo = new PrismaOrderRepository(prisma);
    const order = makeOrder({ status: OrderStatus.CREATED, customerId: uuidV7() });
    await repo.save(order);
    order.applyReflectedStatus(OrderStatus.ASSIGNED, uuidV7(), new Date());
    await repo.save(order);
    const back = await repo.byId(order.id);
    expect(back?.status).toBe(OrderStatus.ASSIGNED);
    expect(back?.items).toHaveLength(1);
    expect(back?.pickup.country).toBe("PH");
  }), 120000);
});
