import type { OrderRepository, OrderStatusHistoryRepository } from "../../domain/order/order-repository.js";
import type { ProcessedEventRepository } from "./processed-event-repository.js";

export interface TransactionalRepos {
  orders: OrderRepository;
  history: OrderStatusHistoryRepository;
  processedEvents: ProcessedEventRepository;
}
export interface UnitOfWork {
  run<T>(work: (repos: TransactionalRepos) => Promise<T>): Promise<T>;
}
