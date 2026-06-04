import amqp, { type ChannelModel, type Channel } from "amqplib";

export const LOGISTICS_EXCHANGE = "logistics.events";
export const DELAY_EXCHANGE = "logistics.events.delay";

export async function connect(url: string): Promise<{ connection: ChannelModel; channel: Channel }> {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();
  await channel.assertExchange(LOGISTICS_EXCHANGE, "topic", { durable: true });

  // Attempt to assert the delay exchange on a separate, disposable channel.
  // If the x-delayed-message plugin is absent (dev / standard image), RabbitMQ
  // responds with a 406 PRECONDITION-FAILED which closes *that* channel only.
  // Using a separate channel + silencing the 'error' EventEmitter event ensures
  // the main channel stays open for publishing.
  await new Promise<void>((resolve) => {
    connection.createChannel().then((delayCh) => {
      // Suppress the unhandled channel-error EventEmitter event that amqplib
      // emits when the server sends a 406 close frame.
      delayCh.on("error", () => { /* x-delayed-message plugin absent — tolerated */ });
      delayCh.assertExchange(DELAY_EXCHANGE, "x-delayed-message", {
        durable: true,
        arguments: { "x-delayed-type": "topic" },
      }).then(() => delayCh.close()).catch(() => { /* non-fatal */ }).finally(resolve);
    }).catch(resolve);
  });

  return { connection, channel };
}
