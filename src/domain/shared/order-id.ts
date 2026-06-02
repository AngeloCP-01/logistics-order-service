import { v7 as uuidV7 } from "uuid";

export type OrderId = string & { readonly __brand: "OrderId" };

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const OrderId = {
  generate(): OrderId {
    return uuidV7() as OrderId;
  },
  of(value: string): OrderId {
    if (!UUID_RX.test(value)) throw new Error(`invalid OrderId: ${value}`);
    return value as OrderId;
  },
};
