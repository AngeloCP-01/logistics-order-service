import request from "supertest";
import { bootstrap, type IntegrationFixture } from "./helpers/bootstrap.js";
import type { StubAddress } from "./helpers/user-service-stub.js";

const CUSTOMER = "11111111-1111-7111-8111-111111111111";
const ADMIN = "44444444-4444-7444-8444-444444444444";
const ADDR: StubAddress = { id: "22222222-2222-7222-8222-222222222222", userId: CUSTOMER, street: "9 Ave", city: "Manila", country: "PH", lat: 14.6, lng: 121.05 };
const body = { pickup: { street: "12 Dock Rd", city: "Manila", country: "PH", lat: 14.55, lng: 121.02 }, dropoffAddressId: ADDR.id, items: [{ description: "P", quantity: 1 }] };

describe("Order cancellation (integration)", () => {
  let fx: IntegrationFixture;
  beforeAll(async () => { fx = await bootstrap({ startConsumer: false }); }, 120000);
  afterAll(async () => { if (fx) await fx.stop(); });
  beforeEach(async () => { await fx.prismaResetAll(); });

  async function createOrder(): Promise<string> {
    fx.stubAddresses.set(ADDR.id, ADDR);
    const res = await request(fx.baseUrl).post("/orders").set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send(body);
    return res.body.id;
  }

  it("customer cancels a created order (200) and a second cancel is 409", async () => {
    const id = await createOrder();
    expect((await request(fx.baseUrl).post(`/orders/${id}/cancel`).set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send({ reason: "no" })).status).toBe(200);
    expect((await request(fx.baseUrl).post(`/orders/${id}/cancel`).set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send({})).status).toBe(409);
  });

  it("forbids a customer cancelling an in_transit order (403) but admin with reason succeeds", async () => {
    const id = await createOrder();
    // advance to in_transit directly through the repo to isolate this test from the consumer
    await fx.pg.prisma.order.update({ where: { id }, data: { status: "in_transit" } });
    expect((await request(fx.baseUrl).post(`/orders/${id}/cancel`).set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send({ reason: "x" })).status).toBe(403);
    expect((await request(fx.baseUrl).post(`/orders/${id}/cancel`).set("authorization", `Bearer ${fx.signUserJwt(ADMIN, "admin")}`).send({})).status).toBe(400); // reason required
    expect((await request(fx.baseUrl).post(`/orders/${id}/cancel`).set("authorization", `Bearer ${fx.signUserJwt(ADMIN, "admin")}`).send({ reason: "accident" })).status).toBe(200);
  });
});
