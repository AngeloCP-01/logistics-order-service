import express from "express";
import type { Server } from "node:http";

export interface StubAddress {
  id: string;
  userId: string;
  label?: string;
  street: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

/**
 * Tiny Express server standing in for user-service's internal address lookup,
 * so create-order can resolve a dropoff without a real user-service. Answers
 * `GET /v1/users/internal/addresses/:id`: 401 without an `x-service-authorization`
 * Bearer header, 404 if the id is unknown, else the address JSON. Listens on an
 * ephemeral port; returns the base URL + a stop function.
 */
export async function startUserServiceStub(
  addresses: Map<string, StubAddress>,
): Promise<{ url: string; stop: () => Promise<void> }> {
  const app = express();
  // Close the socket after each response. Node's global fetch (undici) keeps
  // connections alive and pools them; against this ephemeral stub a reused
  // socket can stall (undici's headersTimeout is 300s → looks like a hang).
  // Forcing `Connection: close` makes every request use a fresh socket.
  app.use((_req, res, next) => {
    res.set("Connection", "close");
    next();
  });
  app.get("/v1/users/internal/addresses/:id", (req, res) => {
    if (!req.header("x-service-authorization")?.startsWith("Bearer ")) {
      res.status(401).end();
      return;
    }
    const a = addresses.get(req.params.id);
    if (!a) {
      res.status(404).end();
      return;
    }
    res.json(a);
  });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  server.keepAliveTimeout = 0;
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}
