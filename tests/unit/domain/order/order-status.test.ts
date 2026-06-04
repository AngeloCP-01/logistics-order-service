import { OrderStatus, rankOf, isTerminal } from "@/domain/order/order-status.js";

describe("OrderStatus rank", () => {
  it("ranks the linear lifecycle ascending", () => {
    expect(rankOf(OrderStatus.CREATED)).toBeLessThan(rankOf(OrderStatus.ASSIGNED));
    expect(rankOf(OrderStatus.ASSIGNED)).toBeLessThan(rankOf(OrderStatus.IN_TRANSIT));
    expect(rankOf(OrderStatus.IN_TRANSIT)).toBeLessThan(rankOf(OrderStatus.COMPLETED));
  });
  it("treats completed and cancelled as terminal", () => {
    expect(isTerminal(OrderStatus.COMPLETED)).toBe(true);
    expect(isTerminal(OrderStatus.CANCELLED)).toBe(true);
    expect(isTerminal(OrderStatus.CREATED)).toBe(false);
  });
});
