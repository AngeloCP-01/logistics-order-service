import type { Channel } from "amqplib";

/**
 * Shared seam that lets `withTestBroker` hand the live amqp `Channel` to the
 * `withTestDb`-wrapped callback without changing the call-site shape. The
 * call sites read `withTestBroker(withTestDb(async (prisma, channel) => ...))`;
 * `withTestBroker` sets the current channel here and `withTestDb` reads it back
 * to forward as the second argument. Only one broker is ever active per test
 * because the runner executes integration tests with `--runInBand`.
 */
let currentChannel: Channel | null = null;

export function setCurrentChannel(channel: Channel | null): void {
  currentChannel = channel;
}

export function getCurrentChannel(): Channel | null {
  return currentChannel;
}
