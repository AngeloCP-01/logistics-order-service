import { Coordinates } from "@/domain/shared/coordinates.js";
import { InvariantViolationError } from "@/domain/shared/errors.js";

describe("Coordinates", () => {
  it("accepts in-range lat/lng", () => {
    const c = Coordinates.of(14.55, 121.02);
    expect(c.lat).toBe(14.55);
    expect(c.lng).toBe(121.02);
  });
  it("rejects lat > 90", () => {
    expect(() => Coordinates.of(91, 0)).toThrow(InvariantViolationError);
  });
  it("rejects lng < -180", () => {
    expect(() => Coordinates.of(0, -181)).toThrow(InvariantViolationError);
  });
});
