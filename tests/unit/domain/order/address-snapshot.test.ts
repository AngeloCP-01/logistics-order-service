import { AddressSnapshot } from "@/domain/order/address-snapshot.js";
import { Coordinates } from "@/domain/shared/coordinates.js";
import { InvariantViolationError } from "@/domain/shared/errors.js";

const valid = { label: "Home", street: "12 Dock Rd", city: "Manila", country: "PH", coordinates: Coordinates.of(14.5, 121.0) };

describe("AddressSnapshot", () => {
  it("constructs from valid parts", () => {
    const a = AddressSnapshot.of(valid);
    expect(a.street).toBe("12 Dock Rd");
    expect(a.country).toBe("PH");
  });
  it("uppercases the country code", () => {
    expect(AddressSnapshot.of({ ...valid, country: "ph" }).country).toBe("PH");
  });
  it("rejects empty street", () => {
    expect(() => AddressSnapshot.of({ ...valid, street: "  " })).toThrow(InvariantViolationError);
  });
  it("rejects a non-2-letter country", () => {
    expect(() => AddressSnapshot.of({ ...valid, country: "PHL" })).toThrow(InvariantViolationError);
  });
  it("treats label as optional", () => {
    const a = AddressSnapshot.of({ ...valid, label: undefined });
    expect(a.label).toBeUndefined();
  });
});
