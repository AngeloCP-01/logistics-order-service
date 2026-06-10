import request from "supertest";
import { bootstrap, type IntegrationFixture } from "./helpers/bootstrap.js";
import type { StubAddress } from "./helpers/user-service-stub.js";

const CUSTOMER = "11111111-1111-7111-8111-111111111111";
const ADDR: StubAddress = { id: "22222222-2222-7222-8222-222222222222", userId: CUSTOMER, label: "Home", street: "9 Ave", city: "Manila", country: "PH", lat: 14.6, lng: 121.05 };
const body = {
  pickup: { street: "12 Dock Rd", city: "Manila", country: "PH", lat: 14.55, lng: 121.02 },
  dropoffAddressId: ADDR.id,
  items: [{ description: "Parcel", quantity: 2, weightKg: 1.5 }],
};

describe("Order HTTP (integration)", () => {
  let fx: IntegrationFixture;
  beforeAll(async () => { fx = await bootstrap({ startConsumer: false }); }, 120000);
  afterAll(async () => { if (fx) await fx.stop(); });
  beforeEach(async () => { await fx.prismaResetAll(); });

  it("creates an order, snapshots the dropoff, writes history, returns 201 + Location", async () => {
    fx.stubAddresses.set(ADDR.id, ADDR);
    const res = await request(fx.baseUrl).post("/v1/orders").set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send(body);
    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/^\/v1\/orders\//);
    expect(res.body.status).toBe("created");
    expect(res.body.dropoff.street).toBe("9 Ave");
    const history = await fx.pg.prisma.orderStatusHistory.findMany({ where: { orderId: res.body.id } });
    expect(history).toHaveLength(1);
    expect(history[0].toStatus).toBe("created");
  });

  it("rejects a dropoff address owned by someone else with 403", async () => {
    fx.stubAddresses.set(ADDR.id, { ...ADDR, userId: "someone-else" });
    const res = await request(fx.baseUrl).post("/v1/orders").set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send(body);
    expect(res.status).toBe(403);
  });

  it("rejects a nonexistent dropoff address with 422", async () => {
    // stubAddresses left empty -> stub returns 404 -> use-case maps to 422
    const res = await request(fx.baseUrl).post("/v1/orders").set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send(body);
    expect(res.status).toBe(422);
  });

  it("hides another customer's order behind 404 and lets admin read it", async () => {
    fx.stubAddresses.set(ADDR.id, ADDR);
    const created = await request(fx.baseUrl).post("/v1/orders").set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send(body);
    const id = created.body.id;
    expect((await request(fx.baseUrl).get(`/v1/orders/${id}`).set("authorization", `Bearer ${fx.signUserJwt("33333333-3333-7333-8333-333333333333", "customer")}`)).status).toBe(404);
    expect((await request(fx.baseUrl).get(`/v1/orders/${id}`).set("authorization", `Bearer ${fx.signUserJwt("44444444-4444-7444-8444-444444444444", "admin")}`)).status).toBe(200);
  });

  it("does NOT shadow /orders/me with /orders/:id (mount-order regression)", async () => {
    fx.stubAddresses.set(ADDR.id, ADDR);
    await request(fx.baseUrl).post("/v1/orders").set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`).send(body);
    const res = await request(fx.baseUrl).get("/v1/orders/me").set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
  });

  it("forbids a customer from listing all orders (admin-only)", async () => {
    const res = await request(fx.baseUrl).get("/v1/orders").set("authorization", `Bearer ${fx.signUserJwt(CUSTOMER, "customer")}`);
    expect(res.status).toBe(403);
  });
});
