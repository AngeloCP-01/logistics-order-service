import type { Channel } from "amqplib";
import { v7 as uuidV7 } from "uuid";
import type { EventPublisher } from "../../application/ports/event-publisher.js";
import type { DomainEvent } from "../../domain/events/index.js";
import { LOGISTICS_EXCHANGE } from "./rabbitmq-connection.js";

export class RabbitMqEventPublisher implements EventPublisher {
  constructor(private readonly channel: Channel) {}

  async publishAll(events: DomainEvent[], correlationId: string): Promise<void> {
    for (const event of events) await this.publishOne(event, correlationId);
  }

  private async publishOne(event: DomainEvent, correlationId: string): Promise<void> {
    const data = this.dataFor(event);
    const envelope = {
      eventId: uuidV7(),
      eventType: event.eventType,
      eventVersion: "1.0.0",
      occurredAt: event.occurredAt.toISOString(),
      correlationId,
      producer: "order-service",
      data,
    };
    const ok = this.channel.publish(
      LOGISTICS_EXCHANGE, event.eventType, Buffer.from(JSON.stringify(envelope)),
      { contentType: "application/json", persistent: true, messageId: envelope.eventId },
    );
    if (!ok) await new Promise((resolve) => this.channel.once("drain", resolve));
  }

  private dataFor(event: DomainEvent): Record<string, unknown> {
    switch (event.eventType) {
      case "order.created":
        return {
          orderId: event.orderId,
          customerId: event.customerId,
          pickup: event.pickup.toJSON(),
          dropoff: event.dropoff.toJSON(),
          items: event.items.map((i) => ({ description: i.description, quantity: i.quantity, weightKg: i.weightKg ?? null })),
          scheduledFor: event.scheduledFor ? event.scheduledFor.toISOString() : null,
        };
      case "order.status.changed":
        return { orderId: event.orderId, fromStatus: event.fromStatus, toStatus: event.toStatus, changedBy: event.changedBy };
      case "order.cancelled":
        return { orderId: event.orderId, customerId: event.customerId, previousStatus: event.previousStatus, reason: event.reason };
    }
  }
}
