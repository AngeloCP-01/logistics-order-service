import type { Order } from "@/domain/order/order.js";
import type { OrderId } from "@/domain/shared/order-id.js";
import type {
  OrderRepository, OrderStatusHistoryRepository, NewStatusHistoryEntry, OrderPage, PageQuery,
} from "@/domain/order/order-repository.js";
import type { ProcessedEventRepository } from "@/application/ports/processed-event-repository.js";
import type { UnitOfWork, TransactionalRepos } from "@/application/ports/unit-of-work.js";
import type { EventPublisher } from "@/application/ports/event-publisher.js";
import type { DomainEvent } from "@/domain/events/index.js";
import type { Clock } from "@/application/ports/clock.js";
import type { UserAddressResolver, ResolvedAddress } from "@/application/ports/user-address-resolver.js";

export class FakeOrderRepository implements OrderRepository {
  readonly store = new Map<string, Order>();
  async byId(id: OrderId): Promise<Order | null> { return this.store.get(id) ?? null; }
  async save(order: Order): Promise<void> { this.store.set(order.id, order); }
  async pageByCustomer(customerId: string, q: PageQuery): Promise<OrderPage> {
    const items = [...this.store.values()]
      .filter((o) => o.customerId === customerId && (!q.status || o.status === q.status))
      .slice(0, q.limit);
    return { items, nextCursor: null };
  }
  async page(q: PageQuery & { customerId?: string }): Promise<OrderPage> {
    const items = [...this.store.values()]
      .filter((o) => (!q.customerId || o.customerId === q.customerId) && (!q.status || o.status === q.status))
      .slice(0, q.limit);
    return { items, nextCursor: null };
  }
}

export class FakeHistoryRepository implements OrderStatusHistoryRepository {
  readonly entries: NewStatusHistoryEntry[] = [];
  async record(entry: NewStatusHistoryEntry): Promise<void> { this.entries.push(entry); }
}

export class FakeProcessedEventRepository implements ProcessedEventRepository {
  readonly seen = new Set<string>();
  async recordIfNew(eventId: string): Promise<boolean> {
    if (this.seen.has(eventId)) return false;
    this.seen.add(eventId); return true;
  }
}

export class FakeUnitOfWork implements UnitOfWork {
  constructor(
    readonly orders: FakeOrderRepository,
    readonly history: FakeHistoryRepository,
    readonly processedEvents: FakeProcessedEventRepository,
  ) {}
  async run<T>(work: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    return work({ orders: this.orders, history: this.history, processedEvents: this.processedEvents });
  }
}

export class FakeEventPublisher implements EventPublisher {
  readonly published: DomainEvent[] = [];
  async publishAll(events: DomainEvent[]): Promise<void> { this.published.push(...events); }
}

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date { return new Date(this.fixed.getTime()); }
}

export class FakeUserAddressResolver implements UserAddressResolver {
  constructor(private readonly addresses: Map<string, ResolvedAddress>) {}
  async resolve(addressId: string): Promise<ResolvedAddress | null> {
    return this.addresses.get(addressId) ?? null;
  }
}
