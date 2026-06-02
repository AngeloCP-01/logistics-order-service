import { OrderItem } from "@/domain/order/order-item.js";
import { InvariantViolationError } from "@/domain/shared/errors.js";

describe("OrderItem", () => {
  it("constructs with description, quantity, optional weight", () => {
    const item = OrderItem.of({ description: "Parcel", quantity: 2, weightKg: 1.5 });
    expect(item.quantity).toBe(2);
    expect(item.weightKg).toBe(1.5);
  });
  it("allows omitted weight", () => {
    expect(OrderItem.of({ description: "Parcel", quantity: 1 }).weightKg).toBeUndefined();
  });
  it("rejects empty description", () => {
    expect(() => OrderItem.of({ description: " ", quantity: 1 })).toThrow(InvariantViolationError);
  });
  it("rejects quantity < 1", () => {
    expect(() => OrderItem.of({ description: "x", quantity: 0 })).toThrow(InvariantViolationError);
  });
  it("rejects non-integer quantity", () => {
    expect(() => OrderItem.of({ description: "x", quantity: 1.5 })).toThrow(InvariantViolationError);
  });
  it("rejects weight <= 0 when present", () => {
    expect(() => OrderItem.of({ description: "x", quantity: 1, weightKg: 0 })).toThrow(InvariantViolationError);
  });
});
