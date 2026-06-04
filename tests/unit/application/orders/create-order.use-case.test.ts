import { CreateOrderUseCase } from "@/application/orders/create-order.use-case.js";
import { OrderStatus } from "@/domain/order/order-status.js";
import { ForbiddenError, UnprocessableEntityError } from "@/domain/shared/errors.js";
import {
  FakeOrderRepository, FakeHistoryRepository, FakeProcessedEventRepository,
  FakeUnitOfWork, FakeEventPublisher, FixedClock, FakeUserAddressResolver,
} from "@tests/unit/application/_fakes.js";
import type { ResolvedAddress } from "@/application/ports/user-address-resolver.js";

const NOW = new Date("2026-06-02T10:00:00Z");
const CUSTOMER = "11111111-1111-7111-8111-111111111111";
const ADDR_ID = "22222222-2222-7222-8222-222222222222";

function build(resolved: ResolvedAddress | null) {
  const orders = new FakeOrderRepository();
  const history = new FakeHistoryRepository();
  const uow = new FakeUnitOfWork(orders, history, new FakeProcessedEventRepository());
  const publisher = new FakeEventPublisher();
  const resolver = new FakeUserAddressResolver(new Map(resolved ? [[ADDR_ID, resolved]] : []));
  const sut = new CreateOrderUseCase(uow, publisher, resolver, new FixedClock(NOW), () => "33333333-3333-7333-8333-333333333333");
  return { sut, orders, history, publisher };
}

const ownedAddress: ResolvedAddress = {
  id: ADDR_ID, userId: CUSTOMER, label: "Home", street: "9 Dropoff Ave",
  city: "Manila", country: "PH", lat: 14.6, lng: 121.05,
};

const input = {
  customerId: CUSTOMER,
  pickup: { street: "12 Dock Rd", city: "Manila", country: "PH", lat: 14.55, lng: 121.02 },
  dropoffAddressId: ADDR_ID,
  items: [{ description: "Parcel", quantity: 2, weightKg: 1.5 }],
  scheduledFor: null as Date | null,
};

describe("CreateOrderUseCase", () => {
  it("creates an order, snapshots both addresses, writes history, publishes order.created", async () => {
    const { sut, orders, history, publisher } = build(ownedAddress);
    const result = await sut.execute(input, "corr-1");
    const saved = orders.store.get(result.id)!;
    expect(saved.status).toBe(OrderStatus.CREATED);
    expect(saved.dropoff.street).toBe("9 Dropoff Ave");
    expect(saved.pickup.street).toBe("12 Dock Rd");
    expect(history.entries[0]).toMatchObject({ fromStatus: null, toStatus: OrderStatus.CREATED });
    expect(publisher.published[0].eventType).toBe("order.created");
  });

  it("rejects a dropoff address owned by someone else (403)", async () => {
    const { sut } = build({ ...ownedAddress, userId: "someone-else" });
    await expect(sut.execute(input, "c")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a nonexistent dropoff address (422)", async () => {
    const { sut } = build(null);
    await expect(sut.execute(input, "c")).rejects.toBeInstanceOf(UnprocessableEntityError);
  });
});
