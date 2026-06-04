import { v7 as uuidV7 } from "uuid";

import { PrismaOrderRepository } from "@/infrastructure/persistence/prisma-order-repository.js";
import { OrderStatus } from "@/domain/order/order-status.js";
import { makeOrder } from "@tests/unit/domain/order/_order-factory.js";
import { bootstrap, type IntegrationFixture } from "./helpers/bootstrap.js";

// customer_id / assigned_driver_id are `@db.Uuid` columns, so the integration
// fixtures must use real UUIDs (the unit fakes can use "cust-1"/"drv-1" because
// they never touch Postgres).
describe("PrismaOrderRepository (integration)", () => {
  let fx: IntegrationFixture;
  beforeAll(async () => { fx = await bootstrap({ startConsumer: false }); }, 120000);
  afterAll(async () => { if (fx) await fx.stop(); });
  beforeEach(async () => { await fx.prismaResetAll(); });

  it("saves and reloads an order with items", async () => {
    const repo = new PrismaOrderRepository(fx.pg.prisma);
    const order = makeOrder({ status: OrderStatus.CREATED, customerId: uuidV7() });
    await repo.save(order);
    const back = await repo.byId(order.id);
    expect(back?.status).toBe(OrderStatus.CREATED);
    expect(back?.items).toHaveLength(1);
    expect(back?.pickup.country).toBe("PH");
  });

  it("upsert on a status change preserves items and addresses", async () => {
    const repo = new PrismaOrderRepository(fx.pg.prisma);
    const order = makeOrder({ status: OrderStatus.CREATED, customerId: uuidV7() });
    await repo.save(order);
    order.applyReflectedStatus(OrderStatus.ASSIGNED, uuidV7(), new Date());
    await repo.save(order);
    const back = await repo.byId(order.id);
    expect(back?.status).toBe(OrderStatus.ASSIGNED);
    expect(back?.items).toHaveLength(1);
    expect(back?.pickup.country).toBe("PH");
  });
});
