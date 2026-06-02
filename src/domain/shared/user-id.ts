export type UserId = string & { readonly __brand: "UserId" };

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UserId = {
  of(value: string): UserId {
    if (!UUID_RX.test(value)) throw new Error(`invalid UserId: ${value}`);
    return value as UserId;
  },
};
