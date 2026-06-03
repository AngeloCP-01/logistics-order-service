import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import type { ChannelModel, Channel } from "amqplib";
import { connect, LOGISTICS_EXCHANGE } from "@/infrastructure/messaging/rabbitmq-connection.js";
import { setCurrentChannel } from "./broker-context.js";

/**
 * Spins a throwaway `rabbitmq:3-management-alpine` container, opens a real
 * connection + channel via the service's own `connect()` helper (which asserts
 * the `logistics.events` topic exchange), publishes the channel into the
 * broker context, then runs the wrapped `withTestDb` body. Composes as
 * `withTestBroker(withTestDb(async (prisma, channel) => ...))` — the channel
 * supplied here is what `withTestDb` forwards as the body's second argument.
 *
 * Connection, channel, and container are torn down in `finally`.
 *
 * Returns a jest-compatible test body so it can be passed straight to `it(...)`.
 */
export function withTestBroker(inner: () => Promise<void>): () => Promise<void> {
  return async () => {
    let container: StartedRabbitMQContainer | null = null;
    let connection: ChannelModel | null = null;
    let channel: Channel | null = null;
    try {
      container = await new RabbitMQContainer("rabbitmq:3-management-alpine").start();
      const established = await connect(container.getAmqpUrl());
      connection = established.connection;
      channel = established.channel;
      // Heartbeat/connection errors can fire when the container is torn down
      // mid-test; tolerate them so they don't crash the runner.
      channel.on("error", () => { /* tolerated in tests */ });
      connection.on("error", () => { /* tolerated in tests */ });
      await channel.assertExchange(LOGISTICS_EXCHANGE, "topic", { durable: true });

      setCurrentChannel(channel);
      await inner();
    } finally {
      setCurrentChannel(null);
      if (channel) {
        try {
          await channel.close();
        } catch {
          /* ignore */
        }
      }
      if (connection) {
        try {
          await connection.close();
        } catch {
          /* ignore */
        }
      }
      if (container) await container.stop();
    }
  };
}
