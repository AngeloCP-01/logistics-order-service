import type { PrismaClient } from "@prisma/client";
import type { UnitOfWork, TransactionalRepos } from "../../application/ports/unit-of-work.js";
import { PrismaOrderRepository } from "./prisma-order-repository.js";
import { PrismaStatusHistoryRepository } from "./prisma-status-history-repository.js";
import { PrismaProcessedEventRepository } from "./prisma-processed-event-repository.js";

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}
  async run<T>(work: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => work({
      orders: new PrismaOrderRepository(tx),
      history: new PrismaStatusHistoryRepository(tx),
      processedEvents: new PrismaProcessedEventRepository(tx),
    }));
  }
}
