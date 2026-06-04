# Order Service — Manual Testing Guide

A hands-on walkthrough to exercise `order-service` locally end-to-end: HTTP endpoints + the event-driven lifecycle. Pair this with [`order-service.http`](order-service.http) (VS Code REST Client) or `curl`.

> **Why order-service needs more setup than auth/user:** creating an order resolves the **dropoff address from user-service** (a service-to-service call) and the **lifecycle is driven by events** from dispatch/tracking (which don't exist yet). This guide gives you two paths:
> - **Path B (fast / isolated)** — a 30-line address stub so you can test order-service alone. Start here.
> - **Path A (realistic)** — run the real user-service (+ auth-service) alongside.

---

## 0. Prerequisites

- Docker running.
- Node 20, repo installed (`npm install`) and building (`npm run build`).
- From the repo root: `/Users/angelito/personal/Logistics-Delivery-Management-System/logistics-order-service`.

Bring up the dev infra:

```bash
# Postgres for order-service (docker-compose.yml → :5436)
docker compose up -d

# RabbitMQ: the platform's shared broker `logistics-rabbitmq` (dev/dev creds)
# is probably already running — check with `docker ps`. If it is, use it and
# skip this. Otherwise start one (note: a bare image defaults to guest/guest):
#   docker run -d --name logistics-rabbitmq -e RABBITMQ_DEFAULT_USER=dev -e RABBITMQ_DEFAULT_PASS=dev \
#     -p 5672:5672 -p 15672:15672 rabbitmq:3.13-management
```

> **Broker credentials:** the platform's `logistics-rabbitmq` uses **`dev`/`dev`**, so `RABBITMQ_URL=amqp://dev:dev@localhost:5672` (this is the `.env.example` default). A bare `rabbitmq` image you start yourself uses `guest`/`guest` — match `RABBITMQ_URL` to whichever broker you point at, or boot fails with `ACCESS_REFUSED`.

Create your `.env` from the example and apply migrations:

```bash
cp .env.example .env
export $(grep -v '^#' .env | xargs)
npm run prisma:migrate    # applies 20260602075820_init_orders to :5436
```

`.env` defaults that matter:

| Var | Default | Note |
|---|---|---|
| `PORT` | `3003` | the API port |
| `ORDER_DB_URL` | `…:5436/order` | dev Postgres |
| `RABBITMQ_URL` | `amqp://dev:dev@localhost:5672` | broker (`logistics-rabbitmq` = dev/dev) |
| `ORDER_JWT_SECRET` | `change-me-…aaaa` | verifies inbound user JWTs — **remember this value, you sign tokens with it** |
| `SERVICE_JWT_SECRET` | `change-me-…bbbb` | signs the outbound service JWT to user-service (must differ from `ORDER_JWT_SECRET`) |
| `ORDER_USER_SERVICE_URL` | `http://localhost:3000` | where the dropoff address is resolved — **you'll point this at the stub or real user-service** |

---

## 1. Pick a path for address resolution

### Path B — address stub (fastest, order-service in isolation)

Save this as `/tmp/addr-stub.js` — a dependency-free HTTP server that answers the one endpoint order-service calls, returning an address **owned by your test customer**:

```js
// /tmp/addr-stub.js  —  run: node /tmp/addr-stub.js
const http = require("node:http");
const CUSTOMER = "01940000-0000-7000-8000-000000000001"; // must match your JWT `sub`
const ADDRESSES = {
  "02940000-0000-7000-8000-0000000000a1": {
    id: "02940000-0000-7000-8000-0000000000a1", userId: CUSTOMER,
    label: "Home", street: "Roxas Blvd", city: "Manila", country: "PH", lat: 14.5824, lng: 120.9772,
  },
  // a FOREIGN address (owned by someone else) for the 403 probe:
  "02940000-0000-7000-8000-00000000ffff": {
    id: "02940000-0000-7000-8000-00000000ffff", userId: "00000000-0000-7000-8000-000000000999",
    label: "Other", street: "Elsewhere", city: "Cebu", country: "PH", lat: 10.3, lng: 123.9,
  },
};
http.createServer((req, res) => {
  const m = req.url.match(/^\/v1\/users\/internal\/addresses\/([^/?]+)/);
  if (!m) { res.writeHead(404).end(); return; }
  if (!(req.headers["x-service-authorization"] || "").startsWith("Bearer ")) { res.writeHead(401).end(); return; }
  const a = ADDRESSES[m[1]];
  if (!a) { res.writeHead(404).end(); return; }       // → order-service maps to 422
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(a));
}).listen(3000, () => console.log("addr-stub on http://localhost:3000"));
```

```bash
node /tmp/addr-stub.js          # leave running; keep ORDER_USER_SERVICE_URL=http://localhost:3000
```

The stub ignores the service-JWT signature (it only checks the header is present), so you don't need to align `SERVICE_JWT_SECRET` with anything for Path B.

### Path A — real user-service (realistic)

1. Boot user-service (its own Postgres + RabbitMQ; see its `docs/user-service.http`). Seed a customer profile (via auth-service `POST /auth/register`, or a manual `user.registered` envelope) and create an address — **note its `id` and the owner `userId`**.
2. Set `ORDER_USER_SERVICE_URL` to user-service's base URL.
3. Align secrets: order-service's `SERVICE_JWT_SECRET` **must equal** user-service's `USER_SERVICE_JWT_SECRET`, and your user JWT must be signed with the secret order-service verifies with (`ORDER_JWT_SECRET`). In a full real setup `ORDER_JWT_SECRET == AUTH_JWT_SECRET`.

---

## 2. Boot order-service + verify it's healthy

```bash
npm run dev        # tsx --env-file=.env, listens on :3003
```

In another terminal:

```bash
curl -s localhost:3003/healthz                 # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" localhost:3003/readyz   # 200 when DB + RabbitMQ are up
```

If `readyz` is `503`: Postgres or RabbitMQ isn't reachable — check `docker ps`.

---

## 3. Mint a user JWT (order-service verifies, never mints)

```bash
export $(grep -v '^#' .env | xargs)
# customer token (sub MUST equal the address owner from step 1):
node -e 'const jwt=require("jsonwebtoken"); console.log(jwt.sign({sub:"01940000-0000-7000-8000-000000000001", role:"customer"}, process.env.ORDER_JWT_SECRET, {algorithm:"HS256", expiresIn:"30m"}))'
# admin token:
node -e 'const jwt=require("jsonwebtoken"); console.log(jwt.sign({sub:"01940000-0000-7000-8000-000000000003", role:"admin"}, process.env.ORDER_JWT_SECRET, {algorithm:"HS256", expiresIn:"30m"}))'
```

Paste these into `@customerToken` / `@adminToken` in `order-service.http` (or `export TOKEN=…` for curl).

---

## 4. Exercise the HTTP API

Using `order-service.http` (click "Send Request"), or curl. The happy-path flow + what to expect:

| # | Action | Expect |
|---|---|---|
| 1 | `POST /orders` (pickup inline + `dropoffAddressId` = the stub's `…a1`) | **201**, `Location: /orders/<id>`, body `status:"created"`, `dropoff.street:"Roxas Blvd"` (snapshotted) |
| 2 | `GET /orders/<id>` (customer) | **200**, the order |
| 3 | `GET /orders/me` (customer) | **200**, `{ items:[…1 order], nextCursor:null }` |
| 4 | `GET /orders/<id>` (admin) | **200** (admin reads any) |
| 5 | `GET /orders` (admin) | **200**, all orders |
| 6 | `POST /orders/<id>/cancel` (customer) | **200**, `status:"cancelled"` |

curl example for step 1:

```bash
TOKEN="<paste customer JWT>"
curl -s -X POST localhost:3003/orders \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"pickup":{"label":"Warehouse 3","street":"12 Dock Rd","city":"Manila","country":"PH","lat":14.55,"lng":120.98},
       "dropoffAddressId":"02940000-0000-7000-8000-0000000000a1",
       "items":[{"description":"Sealed parcel","quantity":2,"weightKg":1.5}]}' | jq
```

After a create, confirm the **status history** row was written:

```bash
docker compose exec -T order-postgres psql -U order -d order \
  -c "select from_status, to_status, changed_by from order_status_history order by changed_at;"
# expect: |  created  | customer:01940000-...
```

---

## 5. Drive the lifecycle with events (RabbitMQ UI)

order-service advances status only by **consuming** dispatch/tracking events. Simulate them: open the RabbitMQ management UI at **http://localhost:15672** (login **dev/dev** for `logistics-rabbitmq`; guest/guest for a bare image) → **Exchanges** → `logistics.events` → **Publish message**.

For each, set **Routing key** + **Payload** (replace `<orderId>` with your order's id), then re-`GET /orders/<orderId>` to watch the status climb:

| Routing key | Payload `data` | Order goes to |
|---|---|---|
| `dispatch.driver.assigned` | `{"orderId":"<orderId>","driverId":"04940000-0000-7000-8000-000000000d01"}` | `assigned` (+ `assignedDriverId` set) |
| `delivery.in_transit` | `{"orderId":"<orderId>"}` | `in_transit` |
| `delivery.completed` | `{"orderId":"<orderId>"}` | `completed` (terminal) |

Full envelope to paste (change `eventId` each time, `routingKey` per the table):

```json
{
  "eventId": "03940000-0000-7000-8000-aaaaaaaaaaaa",
  "eventType": "dispatch.driver.assigned",
  "eventVersion": "1.0",
  "occurredAt": "2026-06-04T00:00:00Z",
  "correlationId": "smoke-1",
  "producer": "dispatch-service",
  "data": { "orderId": "<orderId>", "driverId": "04940000-0000-7000-8000-000000000d01" }
}
```

**Observe what order-service re-publishes:** in the UI, **Queues → Add a queue** (e.g. `probe`), bind it to `logistics.events` with routing key `order.status.changed`, then publish the events above — each advance should drop one `order.status.changed` message into `probe` (Get messages to inspect).

**Reflector probes worth running:**
- **Idempotency:** publish the same `dispatch.driver.assigned` (same `eventId`) twice → status stays `assigned`, only ONE `order_status_history` row, ONE `order.status.changed`.
- **Out-of-order:** on a fresh order, publish `delivery.completed` first → it jumps to `completed`; a later `dispatch.driver.assigned` is ignored (no-op).
- **Cancelled is terminal:** cancel an order, then publish `delivery.in_transit` → stays `cancelled` (never revived).

---

## 6. Negative paths (error shapes)

Run the "Negative-path probes" block in `order-service.http`. Expected:

| Probe | Expect |
|---|---|
| No `Authorization` header | **401** |
| Bogus JWT | **401** |
| Dropoff address owned by someone else (`…ffff`) | **403** |
| Nonexistent dropoff address (`…dead`) | **422** |
| Zero items / 3-letter country / past `scheduledFor` | **400** (RFC 7807 `errors[]`) |
| `GET /orders/<id>` as a different customer | **404** (existence-hiding, not 403) |
| `GET /orders` as a customer | **403** |
| Cancel an already-cancelled/completed order | **409** |
| Customer cancels an `in_transit` order | **403** (admin-only past pickup) |

All errors are `application/problem+json` (RFC 7807) with `type`, `title`, `status`, `instance`.

---

## 7. "Looks good" checklist

- [ ] `healthz` 200, `readyz` 200.
- [ ] Create → 201 with a snapshotted dropoff + `Location` header + a `created` history row.
- [ ] `GET /orders/me` returns only your orders; admin `GET /orders` returns all.
- [ ] Publishing assigned → in_transit → completed climbs the status and emits `order.status.changed` each time.
- [ ] Duplicate / out-of-order events are no-ops; cancelled is never revived.
- [ ] Every negative probe returns the status in the table above (no hangs — a hang would mean the async-error bug regressed).

---

## 8. Teardown

```bash
# Ctrl-C the `npm run dev` and the addr-stub
docker compose down                 # dev Postgres
# leave logistics-rabbitmq running (shared); only remove a broker you started yourself
```

---

### Notes / gotchas
- **Paths have no `/v1`** when hitting order-service directly (`:3003/orders`). The gateway adds `/v1` in production.
- **Create is the only endpoint that calls user-service.** Get/list/cancel and the event lifecycle work without it once an order exists.
- The lifecycle producers (dispatch, tracking) arrive in Phases 4–5; until then the RabbitMQ UI is your stand-in.
