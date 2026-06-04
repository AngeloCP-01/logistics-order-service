import request from "supertest";
import { bootstrap, type IntegrationFixture } from "./helpers/bootstrap.js";

describe("readyz (integration)", () => {
  let fx: IntegrationFixture;
  beforeAll(async () => { fx = await bootstrap({ startConsumer: false }); }, 120000);
  afterAll(async () => { if (fx) await fx.stop(); });

  it("returns 200 when DB + channel are healthy", async () => {
    const res = await request(fx.baseUrl).get("/readyz");
    expect(res.status).toBe(200);
  });

  // Stopping Postgres permanently breaks the shared fixture, and setShuttingDown
  // can't be undone, so these two failure cases run after the healthy case and
  // in this order: DB-down asserts the db_unavailable branch (shuttingDown still
  // false), shutting-down asserts the earliest branch last.
  it("returns 503 when Postgres is stopped", async () => {
    await fx.pg.container.stop();
    const res = await request(fx.baseUrl).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.headers["content-type"]).toMatch(/problem\+json/);
  }, 30000);

  it("returns 503 while shutting down", async () => {
    fx.setShuttingDown();
    const res = await request(fx.baseUrl).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.headers["content-type"]).toMatch(/problem\+json/);
  });
});
