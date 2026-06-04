import http from "node:http";
import { v7 as uuidV7 } from "uuid";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./infrastructure/logger.js";
import { createPrismaClient } from "./infrastructure/persistence/prisma-client.js";
import { PrismaUnitOfWork } from "./infrastructure/persistence/prisma-unit-of-work.js";
import { PrismaOrderRepository } from "./infrastructure/persistence/prisma-order-repository.js";
import { SystemClock } from "./infrastructure/clock/system-clock.js";
import { connect } from "./infrastructure/messaging/rabbitmq-connection.js";
import { RabbitMqEventPublisher } from "./infrastructure/messaging/rabbitmq-event-publisher.js";
import { UserJwtVerifier } from "./infrastructure/auth/user-jwt-verifier.js";
import { ServiceJwtSigner } from "./infrastructure/auth/service-jwt-signer.js";
import { UserServiceAddressClient } from "./infrastructure/http/user-service-address-client.js";
import { CreateOrderUseCase } from "./application/orders/create-order.use-case.js";
import { CancelOrderUseCase } from "./application/orders/cancel-order.use-case.js";
import { GetOrderUseCase } from "./application/orders/get-order.use-case.js";
import { ListMyOrdersUseCase } from "./application/orders/list-my-orders.use-case.js";
import { ListOrdersUseCase } from "./application/orders/list-orders.use-case.js";
import { ReflectOrderStatusUseCase } from "./application/events/reflect-order-status.use-case.js";
import { OrderController } from "./interfaces/http/controllers/order-controller.js";
import { HealthController } from "./interfaces/http/controllers/health-controller.js";
import { startOrderEventsConsumer } from "./interfaces/events/order-events-consumer.js";
import { createApp } from "./app.js";

async function main(): Promise<void> {
  if (process.argv[2] === "--healthcheck") {
    process.stdout.write(JSON.stringify({ ok: true, service: "order-service" }) + "\n");
    process.exit(0);
  }
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = createPrismaClient(env);
  await prisma.$connect();
  const { connection, channel } = await connect(env.RABBITMQ_URL);

  const clock = new SystemClock();
  const uow = new PrismaUnitOfWork(prisma);
  const orderReads = new PrismaOrderRepository(prisma);
  const publisher = new RabbitMqEventPublisher(channel);
  const signer = new ServiceJwtSigner(env.SERVICE_JWT_SECRET, "order-service");
  const addresses = new UserServiceAddressClient(env.ORDER_USER_SERVICE_URL, signer);

  const createOrder = new CreateOrderUseCase(uow, publisher, addresses, clock, () => uuidV7());
  const cancelOrder = new CancelOrderUseCase(uow, publisher, clock);
  const getOrder = new GetOrderUseCase(orderReads);
  const listMine = new ListMyOrdersUseCase(orderReads);
  const listAll = new ListOrdersUseCase(orderReads);
  const reflect = new ReflectOrderStatusUseCase(uow, publisher, clock);

  let activeChannel: typeof channel | null = channel;
  channel.on("close", () => {
    activeChannel = null;
  });
  let shuttingDown = false;

  const orders = new OrderController(createOrder, cancelOrder, getOrder, listMine, listAll);
  const health = new HealthController(prisma, () => activeChannel, () => shuttingDown);
  const userJwt = new UserJwtVerifier(env.ORDER_JWT_SECRET);

  const app = createApp({ logger, health, userJwt, orders });
  const consumer = await startOrderEventsConsumer({ channel, logger, reflect });

  const server = http.createServer(app);
  server.listen(env.PORT, () => logger.info({ event: "listening", port: env.PORT }));

  const shutdown = async (signal: string): Promise<void> => {
    shuttingDown = true;
    logger.info({ event: "shutdown_started", signal });
    try {
      await consumer.stop();
      activeChannel = null;
      await channel.close().catch(() => undefined);
      await connection.close().catch(() => undefined);
    } catch (e) {
      logger.warn({ event: "shutdown_amqp_close_failed", err: e });
    }
    server.close(async () => {
      await prisma.$disconnect().catch(() => undefined);
      logger.info({ event: "shutdown_complete" });
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ level: "error", event: "boot_failed", err: String(err) }) + "\n");
  process.exit(1);
});
