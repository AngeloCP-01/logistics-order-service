import type { UserAddressResolver, ResolvedAddress } from "../../application/ports/user-address-resolver.js";
import type { ServiceJwtSigner } from "../auth/service-jwt-signer.js";

type FetchFn = (url: string, init: { method: string; headers: Record<string, string> }) => Promise<Response>;

export class UserServiceAddressClient implements UserAddressResolver {
  constructor(
    private readonly baseUrl: string,
    private readonly signer: ServiceJwtSigner,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async resolve(addressId: string, correlationId: string): Promise<ResolvedAddress | null> {
    const token = this.signer.sign("user-service");
    const res = await this.fetchFn(`${this.baseUrl}/v1/users/internal/addresses/${addressId}`, {
      method: "GET",
      headers: {
        "X-Service-Authorization": `Bearer ${token}`,
        "X-Request-Id": correlationId,
        Accept: "application/json",
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`user-service address lookup failed: ${res.status}`);
    return (await res.json()) as ResolvedAddress;
  }
}
