import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Spins a throwaway `postgres:16-alpine` container, applies the Prisma
 * migrations against it, and hands a connected `PrismaClient` to `fn`.
 * The container + client are torn down after `fn` resolves or rejects.
 *
 * Returns a jest-compatible test body so it can be passed straight to `it(...)`.
 */
export function withTestDb(fn: (prisma: PrismaClient) => Promise<void>): () => Promise<void> {
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
      await fn(prisma);
    } finally {
      if (prisma) await prisma.$disconnect();
      if (container) await container.stop();
    }
  };
}
