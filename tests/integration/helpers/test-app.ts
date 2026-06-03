import jwt from "jsonwebtoken";
import { v7 as uuidV7 } from "uuid";
import pino from "pino";
import type { PrismaClient } from "@prisma/client";
import type { Channel } from "amqplib";
import { createApp } from "@/app.js";
import { PrismaUnitOfWork } from "@/infrastructure/persistence/prisma-unit-of-work.js";
import { PrismaOrderRepository } from "@/infrastructure/persistence/prisma-order-repository.js";
import { SystemClock } from "@/infrastructure/clock/system-clock.js";
import { RabbitMqEventPublisher } from "@/infrastructure/messaging/rabbitmq-event-publisher.js";
import { ServiceJwtSigner } from "@/infrastructure/auth/service-jwt-signer.js";
import { UserServiceAddressClient } from "@/infrastructure/http/user-service-address-client.js";
import { UserJwtVerifier } from "@/infrastructure/auth/user-jwt-verifier.js";
import { CreateOrderUseCase } from "@/application/orders/create-order.use-case.js";
import { CancelOrderUseCase } from "@/application/orders/cancel-order.use-case.js";
import { GetOrderUseCase } from "@/application/orders/get-order.use-case.js";
import { ListMyOrdersUseCase } from "@/application/orders/list-my-orders.use-case.js";
import { ListOrdersUseCase } from "@/application/orders/list-orders.use-case.js";
import { ReflectOrderStatusUseCase } from "@/application/events/reflect-order-status.use-case.js";
import { OrderController } from "@/interfaces/http/controllers/order-controller.js";
import { HealthController } from "@/interfaces/http/controllers/health-controller.js";
import { startOrderEventsConsumer } from "@/interfaces/events/order-events-consumer.js";

const { sign } = jwt;

export const USER_SECRET = "u".repeat(40);
export const SERVICE_SECRET = "s".repeat(40);

/**
 * Mints a user JWT shaped exactly as `UserJwtVerifier` expects: `sub` carries
 * the userId (set via `subject`), `role` is a top-level claim, signed HS256
 * with `USER_SECRET`.
 */
export function userToken(userId: string, role: "customer" | "driver" | "admin"): string {
  return sign({ role }, USER_SECRET, { algorithm: "HS256", subject: userId, expiresIn: 900 });
}

/**
 * Wires the REAL `createApp` against the supplied real Prisma client + real amqp
 * channel + a `UserServiceAddressClient` pointed at the stub, and starts the
 * REAL order events consumer. Returns the Express app, the consumer handle, and
 * the publisher for tests that need to drive or assert on them.
 */
export async function buildTestApp(
  prisma: PrismaClient,
  channel: Channel,
  userStubUrl: string,
): Promise<{ app: ReturnType<typeof createApp>; consumer: { stop: () => Promise<void> }; publisher: RabbitMqEventPublisher }> {
  const clock = new SystemClock();
  const uow = new PrismaUnitOfWork(prisma);
  const reads = new PrismaOrderRepository(prisma);
  const publisher = new RabbitMqEventPublisher(channel);
  const signer = new ServiceJwtSigner(SERVICE_SECRET, "order-service");
  const addresses = new UserServiceAddressClient(userStubUrl, signer);
  const orders = new OrderController(
    new CreateOrderUseCase(uow, publisher, addresses, clock, () => uuidV7()),
    new CancelOrderUseCase(uow, publisher, clock),
    new GetOrderUseCase(reads),
    new ListMyOrdersUseCase(reads),
    new ListOrdersUseCase(reads),
  );
  const reflect = new ReflectOrderStatusUseCase(uow, publisher, clock);
  const health = new HealthController(prisma, () => channel, () => false);
  const app = createApp({
    logger: pino({ level: "silent" }),
    health,
    userJwt: new UserJwtVerifier(USER_SECRET),
    orders,
  });
  const consumer = await startOrderEventsConsumer({ channel, logger: pino({ level: "silent" }), reflect });
  return { app, consumer, publisher };
}
