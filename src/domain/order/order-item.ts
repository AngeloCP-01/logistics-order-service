import { InvariantViolationError } from "../shared/errors.js";

export interface OrderItemProps {
  description: string;
  quantity: number;
  weightKg?: number | undefined;
}

export class OrderItem {
  private constructor(
    readonly description: string,
    readonly quantity: number,
    readonly weightKg: number | undefined,
  ) {}

  static of(props: OrderItemProps): OrderItem {
    const description = props.description.trim();
    if (description.length === 0) throw new InvariantViolationError("item description must be non-empty");
    if (!Number.isInteger(props.quantity) || props.quantity < 1) {
      throw new InvariantViolationError("item quantity must be an integer >= 1");
    }
    if (props.weightKg !== undefined && !(props.weightKg > 0)) {
      throw new InvariantViolationError("item weightKg must be > 0 when present");
    }
    return new OrderItem(description, props.quantity, props.weightKg);
  }
}
