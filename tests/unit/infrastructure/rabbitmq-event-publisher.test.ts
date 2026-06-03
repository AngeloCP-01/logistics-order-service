import { RabbitMqEventPublisher } from "@/infrastructure/messaging/rabbitmq-event-publisher.js";
import { OrderCreated } from "@/domain/events/order-created.js";
import { OrderId } from "@/domain/shared/order-id.js";
import { AddressSnapshot } from "@/domain/order/address-snapshot.js";
import { OrderItem } from "@/domain/order/order-item.js";
import { Coordinates } from "@/domain/shared/coordinates.js";

function fakeChannel() {
  const calls: { key: string; body: unknown }[] = [];
  return {
    calls,
    publish(_ex: string, key: string, buf: Buffer) { calls.push({ key, body: JSON.parse(buf.toString()) }); return true; },
    once() { /* no drain needed */ },
  };
}

const addr = AddressSnapshot.of({ street: "S", city: "Manila", country: "PH", coordinates: Coordinates.of(14.5, 121.0) });

describe("RabbitMqEventPublisher", () => {
  it("publishes order.created with the full envelope + data", async () => {
    const ch = fakeChannel();
    const pub = new RabbitMqEventPublisher(ch as never);
    const ev = new OrderCreated(OrderId.generate(), "cust-1", addr, addr, [OrderItem.of({ description: "P", quantity: 1 })], null, new Date("2026-06-02T10:00:00Z"));
    await pub.publishAll([ev], "corr-9");
    expect(ch.calls[0].key).toBe("order.created");
    const body = ch.calls[0].body as { producer: string; correlationId: string; data: { items: unknown[] } };
    expect(body.producer).toBe("order-service");
    expect(body.correlationId).toBe("corr-9");
    expect(body.data.items).toHaveLength(1);
  });
});
