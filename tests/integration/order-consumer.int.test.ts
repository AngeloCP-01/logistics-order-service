import request from "supertest";
import { v7 as uuidV7 } from "uuid";
import { bootstrap, type IntegrationFixture } from "./helpers/bootstrap.js";
import type { StubAddress } from "./helpers/user-service-stub.js";

const CUSTOMER = "11111111-1111-7111-8111-111111111111";
const ADDR: StubAddress = { id: "22222222-2222-7222-8222-222222222222", userId: CUSTOMER, street: "9 Ave", city: "Manila", country: "PH", lat: 14.6, lng: 121.05 };
const body = { pickup: { street: "12 Dock Rd", city: "Manila", country: "PH", lat: 14.55, lng: 121.02 }, dropoffAddressId: ADDR.id, items: [{ description: "P", quantity: 1 }] };

function makeEnvelope(eventType: string, data: unknown, eventId = uuidV7()): Record<string, unknown> {
  return { eventId, eventType, eventVersion: "1.0", occurredAt: new Date().toISOString(), correlationId: "c", producer: "test", data };
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 600));

describe("Order consumer (integration)", () => {
  let fx: IntegrationFixture;
  beforeAll(async () => { fx = await bootstrap({ startConsumer: true }); }, 120000);
  afterAll(async () => { if (fx) await fx.stop(); });
  beforeEach(async () => { await fx.prismaResetAll(); });

  async function createOrder(): Promise<string> {
    fx.stubAddresses.set(ADDR.id, ADDR);
    const res = await request(fx.baseUrl).post("/orders").set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send(body);
    return res.body.id;
  }

  it("advances created -> assigned on dispatch.driver.assigned", async () => {
    const id = await createOrder();
    const driverId = uuidV7();
    await fx.publishEvent("dispatch.driver.assigned", makeEnvelope("dispatch.driver.assigned", { orderId: id, driverId }));
    await settle();
    const row = await fx.pg.prisma.order.findUnique({ where: { id } });
    expect(row?.status).toBe("assigned");
    expect(row?.assignedDriverId).toBe(driverId);
  });

  it("is idempotent: a duplicate eventId writes one history row only", async () => {
    const id = await createOrder();
    const eid = uuidV7();
    await fx.publishEvent("delivery.completed", makeEnvelope("delivery.completed", { orderId: id }, eid));
    await fx.publishEvent("delivery.completed", makeEnvelope("delivery.completed", { orderId: id }, eid));
    await settle();
    const hist = await fx.pg.prisma.orderStatusHistory.findMany({ where: { orderId: id, toStatus: "completed" } });
    expect(hist).toHaveLength(1);
  });

  it("tolerates out-of-order: completed before assigned still ends completed; late assigned is a no-op", async () => {
    const id = await createOrder();
    await fx.publishEvent("delivery.completed", makeEnvelope("delivery.completed", { orderId: id }));
    await settle();
    await fx.publishEvent("dispatch.driver.assigned", makeEnvelope("dispatch.driver.assigned", { orderId: id, driverId: uuidV7() }));
    await settle();
    const row = await fx.pg.prisma.order.findUnique({ where: { id } });
    expect(row?.status).toBe("completed");
    expect(row?.assignedDriverId).toBeNull();
  });
});
