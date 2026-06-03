import { createOrderSchema, listQuerySchema } from "@/interfaces/http/schemas.js";

describe("createOrderSchema", () => {
  const valid = {
    pickup: { street: "12 Dock Rd", city: "Manila", country: "PH", lat: 14.55, lng: 121.02 },
    dropoffAddressId: "22222222-2222-7222-8222-222222222222",
    items: [{ description: "Parcel", quantity: 2, weightKg: 1.5 }],
  };
  it("accepts a valid body", () => { expect(createOrderSchema.parse(valid)).toBeTruthy(); });
  it("rejects an empty items array", () => { expect(() => createOrderSchema.parse({ ...valid, items: [] })).toThrow(); });
  it("rejects a 3-letter country", () => { expect(() => createOrderSchema.parse({ ...valid, pickup: { ...valid.pickup, country: "PHL" } })).toThrow(); });
  it("rejects a past scheduledFor", () => {
    expect(() => createOrderSchema.parse({ ...valid, scheduledFor: "2000-01-01T00:00:00Z" })).toThrow();
  });
});

describe("listQuerySchema", () => {
  it("defaults limit to 20", () => { expect(listQuerySchema.parse({}).limit).toBe(20); });
});
