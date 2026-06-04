import { ServiceJwtSigner } from "@/infrastructure/auth/service-jwt-signer.js";
import { UserServiceAddressClient } from "@/infrastructure/http/user-service-address-client.js";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn = async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
  };
  return Object.assign(fn, { calls });
}

const signer = new ServiceJwtSigner("x".repeat(40), "order-service");

describe("UserServiceAddressClient", () => {
  it("resolves an address and forwards the service JWT", async () => {
    const fetchFn = fakeFetch(200, { id: "a1", userId: "u1", label: "Home", street: "S", city: "Manila", country: "PH", lat: 14.5, lng: 121.0 });
    const client = new UserServiceAddressClient("http://user", signer, fetchFn as never);
    const res = await client.resolve("a1", "corr-1");
    expect(res?.userId).toBe("u1");
    expect(fetchFn.calls[0]!.url).toBe("http://user/v1/users/internal/addresses/a1");
    expect(fetchFn.calls[0]!.headers["X-Service-Authorization"]).toMatch(/^Bearer /);
    expect(fetchFn.calls[0]!.headers["X-Request-Id"]).toBe("corr-1");
  });

  it("returns null on 404", async () => {
    const fetchFn = fakeFetch(404, {});
    const client = new UserServiceAddressClient("http://user", signer, fetchFn as never);
    expect(await client.resolve("missing", "c")).toBeNull();
  });

  it("throws on a 5xx", async () => {
    const fetchFn = fakeFetch(503, {});
    const client = new UserServiceAddressClient("http://user", signer, fetchFn as never);
    await expect(client.resolve("a1", "c")).rejects.toThrow();
  });
});
