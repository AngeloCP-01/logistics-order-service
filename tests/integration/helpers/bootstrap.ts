import http, { type Server } from "node:http";
import jwt from "jsonwebtoken";
const { sign } = jwt;
import { v7 as uuidV7 } from "uuid";
import pino from "pino";
import { PrismaClient } from "@prisma/client";
import { startPgWithMigrations, stopPg, type PgFixture } from "./postgres-container.js";
import { startRabbit, stopRabbit, type RabbitFixture } from "./rabbitmq-container.js";
import { startUserServiceStub, type StubAddress } from "./user-service-stub.js";
import { connect, LOGISTICS_EXCHANGE } from "../../../src/infrastructure/messaging/rabbitmq-connection.js";
import { PrismaUnitOfWork } from "../../../src/infrastructure/persistence/prisma-unit-of-work.js";
import { PrismaOrderRepository } from "../../../src/infrastructure/persistence/prisma-order-repository.js";
import { RabbitMqEventPublisher } from "../../../src/infrastructure/messaging/rabbitmq-event-publisher.js";
import { SystemClock } from "../../../src/infrastructure/clock/system-clock.js";
import { UserJwtVerifier } from "../../../src/infrastructure/auth/user-jwt-verifier.js";
import { ServiceJwtSigner } from "../../../src/infrastructure/auth/service-jwt-signer.js";
import { UserServiceAddressClient } from "../../../src/infrastructure/http/user-service-address-client.js";
import { CreateOrderUseCase } from "../../../src/application/orders/create-order.use-case.js";
import { CancelOrderUseCase } from "../../../src/application/orders/cancel-order.use-case.js";
import { GetOrderUseCase } from "../../../src/application/orders/get-order.use-case.js";
import { ListMyOrdersUseCase } from "../../../src/application/orders/list-my-orders.use-case.js";
import { ListOrdersUseCase } from "../../../src/application/orders/list-orders.use-case.js";
import { ReflectOrderStatusUseCase } from "../../../src/application/events/reflect-order-status.use-case.js";
import { OrderController } from "../../../src/interfaces/http/controllers/order-controller.js";
import { HealthController } from "../../../src/interfaces/http/controllers/health-controller.js";
import { startOrderEventsConsumer } from "../../../src/interfaces/events/order-events-consumer.js";
import { createApp } from "../../../src/app.js";

const USER_SECRET = "u".repeat(40);
const SERVICE_SECRET = "s".repeat(40);

export interface IntegrationFixture {
  pg: PgFixture;
  rabbit: RabbitFixture;
  server: Server;
  port: number;
  baseUrl: string;
  stop: () => Promise<void>;
  setShuttingDown: () => void;
  signUserJwt: (userId: string, role: "customer" | "driver" | "admin") => string;
  publishEvent: (routingKey: string, envelope: unknown) => Promise<void>;
  prismaResetAll: () => Promise<void>;
  stubAddresses: Map<string, StubAddress>;
}

export async function bootstrap(opts?: { startConsumer?: boolean }): Promise<IntegrationFixture> {
  const pg = await startPgWithMigrations();
  const rabbit = await startRabbit();

  const logger = pino({ level: "silent" });
  const prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
  await prisma.$connect();

  // Live, mutable address map the stub reads on every request so tests can set
  // owned / foreign / missing addresses per case.
  const stubAddresses = new Map<string, StubAddress>();
  const stub = await startUserServiceStub(stubAddresses);

  const { connection: amqpConn, channel: amqpCh } = await connect(rabbit.url);
  let activeChannel: typeof amqpCh | null = amqpCh;
  amqpCh.on("close", () => { activeChannel = null; });
  // Silence heartbeat/connection errors that fire after the broker container is
  // killed during a test (e.g. readyz-db-down style probes).
  amqpCh.on("error", () => { /* tolerated in tests */ });
  amqpConn.on("error", () => { /* tolerated in tests */ });

  const clock = new SystemClock();
  const uow = new PrismaUnitOfWork(prisma);
  const reads = new PrismaOrderRepository(prisma);
  const publisher = new RabbitMqEventPublisher(amqpCh);
  const signer = new ServiceJwtSigner(SERVICE_SECRET, "order-service");
  const addresses = new UserServiceAddressClient(stub.url, signer);

  const orders = new OrderController(
    new CreateOrderUseCase(uow, publisher, addresses, clock, () => uuidV7()),
    new CancelOrderUseCase(uow, publisher, clock),
    new GetOrderUseCase(reads),
    new ListMyOrdersUseCase(reads),
    new ListOrdersUseCase(reads),
  );
  const reflect = new ReflectOrderStatusUseCase(uow, publisher, clock);

  let shuttingDown = false;
  const health = new HealthController(prisma, () => activeChannel, () => shuttingDown);
  const userJwt = new UserJwtVerifier(USER_SECRET);

  let consumer: { stop: () => Promise<void> } | null = null;
  if (opts?.startConsumer ?? true) {
    consumer = await startOrderEventsConsumer({ channel: amqpCh, logger, reflect });
  }

  const app = createApp({ logger, health, userJwt, orders });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    pg, rabbit, server, port,
    baseUrl: `http://127.0.0.1:${port}`,
    stop: async () => {
      shuttingDown = true;
      try { if (consumer) await consumer.stop(); } catch { /* ignore */ }
      await new Promise<void>((resolve) => server.close(() => resolve()));
      try { await amqpCh.close(); } catch { /* ignore */ }
      try { await amqpConn.close(); } catch { /* ignore */ }
      try { await prisma.$disconnect(); } catch { /* ignore */ }
      try { await stub.stop(); } catch { /* ignore */ }
      try { await stopRabbit(rabbit); } catch { /* ignore */ }
      try { await stopPg(pg); } catch { /* ignore */ }
    },
    setShuttingDown: () => { shuttingDown = true; },
    signUserJwt: (userId, role) => sign({ role }, USER_SECRET, { algorithm: "HS256", subject: userId, expiresIn: "5m" }),
    publishEvent: async (routingKey, envelope) => {
      amqpCh.publish(LOGISTICS_EXCHANGE, routingKey, Buffer.from(JSON.stringify(envelope)), { contentType: "application/json", persistent: true });
    },
    prismaResetAll: async () => {
      await pg.prisma.orderStatusHistory.deleteMany();
      await pg.prisma.orderItem.deleteMany();
      await pg.prisma.order.deleteMany();
      await pg.prisma.processedEvent.deleteMany();
      stubAddresses.clear();
    },
    stubAddresses,
  };
}
