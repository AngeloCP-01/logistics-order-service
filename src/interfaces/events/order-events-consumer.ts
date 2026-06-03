import type { Channel } from "amqplib";
import type { Logger } from "pino";
import { OrderId } from "../../domain/shared/order-id.js";
import { OrderStatus } from "../../domain/order/order-status.js";
import { OrderNotFoundError } from "../../domain/shared/errors.js";
import type { ReflectOrderStatusUseCase } from "../../application/events/reflect-order-status.use-case.js";
import { LOGISTICS_EXCHANGE } from "../../infrastructure/messaging/rabbitmq-connection.js";

export const ORDER_EVENTS_QUEUE = "order-service.lifecycle-events";

const TARGET: Record<string, { status: OrderStatus; usesDriver: boolean }> = {
  "dispatch.driver.assigned": { status: OrderStatus.ASSIGNED, usesDriver: true },
  "delivery.in_transit": { status: OrderStatus.IN_TRANSIT, usesDriver: false },
  "delivery.completed": { status: OrderStatus.COMPLETED, usesDriver: false },
};

export interface OrderConsumerDeps {
  channel: Channel;
  logger: Logger;
  reflect: ReflectOrderStatusUseCase;
}

export async function startOrderEventsConsumer(deps: OrderConsumerDeps): Promise<{ stop: () => Promise<void> }> {
  const { channel, logger, reflect } = deps;
  await channel.assertQueue(ORDER_EVENTS_QUEUE, {
    durable: true,
    deadLetterExchange: "",
    deadLetterRoutingKey: `${ORDER_EVENTS_QUEUE}.dlq`,
  });
  await channel.assertQueue(`${ORDER_EVENTS_QUEUE}.dlq`, { durable: true });
  for (const key of Object.keys(TARGET)) await channel.bindQueue(ORDER_EVENTS_QUEUE, LOGISTICS_EXCHANGE, key);
  await channel.prefetch(8);

  const { consumerTag } = await channel.consume(ORDER_EVENTS_QUEUE, async (msg) => {
    if (!msg) return;
    let envelope: {
      eventId: string;
      eventType: string;
      correlationId: string;
      data: { orderId: string; driverId?: string };
    };
    try {
      envelope = JSON.parse(msg.content.toString());
    } catch {
      logger.warn({ event: "consumer_message_invalid_json" }, "discarding");
      channel.nack(msg, false, false);
      return;
    }

    const mapping = TARGET[envelope.eventType];
    if (!mapping) {
      logger.debug({ event: "consumer_skip_unknown", eventType: envelope.eventType });
      channel.ack(msg);
      return;
    }

    try {
      await reflect.execute(
        {
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          orderId: OrderId.of(envelope.data.orderId),
          target: mapping.status,
          driverId: mapping.usesDriver ? (envelope.data.driverId ?? null) : null,
        },
        envelope.correlationId,
      );
      channel.ack(msg);
    } catch (err) {
      const attempts = (msg.properties.headers?.["x-attempt"] as number | undefined) ?? 0;
      const retryable = err instanceof OrderNotFoundError; // order may still be in flight
      if (retryable && attempts < 3) {
        logger.warn({ event: "consumer_retry", attempts: attempts + 1, eventId: envelope.eventId }, "retrying");
        channel.nack(msg, false, true);
      } else {
        logger.error({ event: "consumer_dlq", err, eventId: envelope.eventId }, "to DLQ");
        channel.nack(msg, false, false);
      }
    }
  });

  return {
    stop: async () => {
      await channel.cancel(consumerTag);
    },
  };
}
