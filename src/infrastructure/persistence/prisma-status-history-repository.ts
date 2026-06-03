import type { PrismaClient, Prisma } from "@prisma/client";
import type { OrderStatusHistoryRepository, NewStatusHistoryEntry } from "../../domain/order/order-repository.js";

type Tx = PrismaClient | Prisma.TransactionClient;

export class PrismaStatusHistoryRepository implements OrderStatusHistoryRepository {
  constructor(private readonly db: Tx) {}

  async record(e: NewStatusHistoryEntry): Promise<void> {
    await this.db.orderStatusHistory.create({
      data: {
        id: crypto.randomUUID(), orderId: e.orderId,
        fromStatus: e.fromStatus ?? null, toStatus: e.toStatus,
        reason: e.reason, changedBy: e.changedBy, changedAt: e.changedAt,
      },
    });
  }
}
