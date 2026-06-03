import type { PrismaClient, Prisma } from "@prisma/client";
import type { OrderId } from "../../domain/shared/order-id.js";
import type { OrderStatus } from "../../domain/order/order-status.js";
import type { Order } from "../../domain/order/order.js";
import type { OrderRepository, OrderPage, PageQuery } from "../../domain/order/order-repository.js";
import { OrderMapper } from "./order-mapper.js";

type Tx = PrismaClient | Prisma.TransactionClient;

function encodeCursor(o: { createdAt: Date; id: string }): string {
  return Buffer.from(`${o.createdAt.toISOString()}|${o.id}`).toString("base64url");
}
function decodeCursor(c: string): { createdAt: Date; id: string } {
  const [iso, id] = Buffer.from(c, "base64url").toString().split("|");
  return { createdAt: new Date(iso), id };
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly db: Tx) {}

  async byId(id: OrderId): Promise<Order | null> {
    const row = await this.db.order.findUnique({ where: { id }, include: { items: true } });
    return row ? OrderMapper.toDomain(row) : null;
  }

  async save(order: Order): Promise<void> {
    const { order: o, items } = OrderMapper.toPersistence(order);
    await this.db.order.upsert({
      where: { id: o.id },
      create: {
        id: o.id, customerId: o.customerId, status: o.status as OrderStatus,
        pickupAddress: o.pickupAddress as Prisma.InputJsonValue,
        dropoffAddress: o.dropoffAddress as Prisma.InputJsonValue,
        dropoffSourceAddressId: o.dropoffSourceAddressId, assignedDriverId: o.assignedDriverId,
        scheduledFor: o.scheduledFor, cancelReason: o.cancelReason,
        createdAt: o.createdAt, updatedAt: o.updatedAt,
        items: { create: items.map((i) => ({ id: i.id, description: i.description, quantity: i.quantity, weightKg: i.weightKg as Prisma.Decimal | null })) },
      },
      update: {
        status: o.status as OrderStatus, assignedDriverId: o.assignedDriverId,
        cancelReason: o.cancelReason, updatedAt: o.updatedAt,
      },
    });
  }

  async pageByCustomer(customerId: string, q: PageQuery): Promise<OrderPage> {
    return this.pageWhere({ customerId, ...(q.status ? { status: q.status as OrderStatus } : {}) }, q);
  }

  async page(q: PageQuery & { customerId?: string | undefined }): Promise<OrderPage> {
    return this.pageWhere({
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.status ? { status: q.status as OrderStatus } : {}),
    }, q);
  }

  private async pageWhere(where: Prisma.OrderWhereInput, q: PageQuery): Promise<OrderPage> {
    const cur = q.cursor ? decodeCursor(q.cursor) : null;
    const rows = await this.db.order.findMany({
      where: cur
        ? { AND: [where, { OR: [{ createdAt: { lt: cur.createdAt } }, { createdAt: cur.createdAt, id: { lt: cur.id } }] }] }
        : where,
      include: { items: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((r) => OrderMapper.toDomain(r)),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    };
  }
}
