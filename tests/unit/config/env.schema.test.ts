import { envSchema } from "../../../src/config/env.schema.js";

const base = {
  NODE_ENV: "test",
  PORT: "3003",
  LOG_LEVEL: "info",
  LOG_SERVICE_NAME: "order-service",
  ORDER_DB_URL: "postgresql://o:o@localhost:5436/order",
  ORDER_JWT_SECRET: "a".repeat(32),
  SERVICE_JWT_SECRET: "b".repeat(32),
  ORDER_USER_SERVICE_URL: "http://localhost:3000",
  RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
};

describe("envSchema", () => {
  it("parses a valid environment", () => {
    const env = envSchema.parse(base);
    expect(env.PORT).toBe(3003);
  });

  it("rejects when ORDER_JWT_SECRET equals SERVICE_JWT_SECRET", () => {
    expect(() => envSchema.parse({ ...base, SERVICE_JWT_SECRET: "a".repeat(32) })).toThrow();
  });

  it("rejects a short secret", () => {
    expect(() => envSchema.parse({ ...base, ORDER_JWT_SECRET: "short" })).toThrow();
  });
});
