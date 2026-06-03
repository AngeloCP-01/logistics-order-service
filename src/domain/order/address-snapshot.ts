import type { Coordinates } from "../shared/coordinates.js";
import { InvariantViolationError } from "../shared/errors.js";

export interface AddressSnapshotProps {
  label?: string | undefined;
  street: string;
  city: string;
  country: string;
  coordinates: Coordinates;
}

export class AddressSnapshot {
  private constructor(
    readonly label: string | undefined,
    readonly street: string,
    readonly city: string,
    readonly country: string,
    readonly coordinates: Coordinates,
  ) {}

  static of(props: AddressSnapshotProps): AddressSnapshot {
    const street = props.street.trim();
    const city = props.city.trim();
    if (street.length === 0) throw new InvariantViolationError("address street must be non-empty");
    if (city.length === 0) throw new InvariantViolationError("address city must be non-empty");
    if (!/^[A-Za-z]{2}$/.test(props.country)) throw new InvariantViolationError("country must be a 2-letter code");
    const label = props.label?.trim();
    return new AddressSnapshot(
      label && label.length > 0 ? label : undefined,
      street, city, props.country.toUpperCase(), props.coordinates,
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      label: this.label, street: this.street, city: this.city,
      country: this.country, lat: this.coordinates.lat, lng: this.coordinates.lng,
    };
  }
}
