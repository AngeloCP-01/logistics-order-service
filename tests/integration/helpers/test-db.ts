import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import type { Channel } from "amqplib";
import { getCurrentChannel } from "./broker-context.js";

/**
 * Spins a throwaway `postgres:16-alpine` container, applies the Prisma
 * migrations against it, and hands a connected `PrismaClient` to `fn`.
 * The container + client are torn down after `fn` resolves or rejects.
 *
 * When composed under `withTestBroker`, the live amqp `Channel` set by the
 * broker helper is forwarded as the second argument, so call sites read
 * `withTestBroker(withTestDb(async (prisma, channel) => ...))`. When used on
 * its own the second argument is `null`.
 *
 * Returns a jest-compatible test body so it can be passed straight to `it(...)`.
 */
export function withTestDb(fn: (prisma: PrismaClient, channel: Channel) => Promise<void>): () => Promise<void> {
  return async () => {
    let container: StartedPostgreSqlContainer | null = null;
    let prisma: PrismaClient | null = null;
    try {
      container = await new PostgreSqlContainer("postgres:16-alpine").start();
      const url = container.getConnectionUri();
      execSync("npx prisma migrate deploy", {
        env: { ...process.env, ORDER_DB_URL: url },
        stdio: "inherit",
      });
      prisma = new PrismaClient({ datasources: { db: { url } } });
      await prisma.$connect();
      await fn(prisma, getCurrentChannel() as Channel);
    } finally {
      if (prisma) await prisma.$disconnect();
      if (container) await container.stop();
    }
  };
}
