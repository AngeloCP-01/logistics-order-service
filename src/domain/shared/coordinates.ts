import { InvariantViolationError } from "./errors.js";

export class Coordinates {
  private constructor(readonly lat: number, readonly lng: number) {}

  static of(lat: number, lng: number): Coordinates {
    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 || lat > 90 ||
      lng < -180 || lng > 180
    ) {
      throw new InvariantViolationError(`invalid coordinates: lat=${lat} lng=${lng}`);
    }
    return new Coordinates(lat, lng);
  }

  equals(other: Coordinates): boolean {
    return this.lat === other.lat && this.lng === other.lng;
  }
}
