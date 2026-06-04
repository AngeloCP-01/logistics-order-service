export interface ResolvedAddress {
  id: string;
  userId: string;
  label?: string | undefined;
  street: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}
export interface UserAddressResolver {
  /** Resolve a saved address by id via user-service. Returns null on 404. */
  resolve(addressId: string, correlationId: string): Promise<ResolvedAddress | null>;
}
