# logistics-order-service

Owns the **order aggregate** for the AI Logistics & Delivery Management Platform: creates single-pickup → single-dropoff deliveries, reflects their lifecycle from dispatch/tracking events, records status history, and carries advisory scheduling.

**Phase:** 3 · **Status:** v0.1.0 · Node 20 / TypeScript (ESM) / Express / Prisma + Postgres / RabbitMQ.

See the design spec: [`../docs/superpowers/specs/2026-06-02-order-service-design.md`](../docs/superpowers/specs/2026-06-02-order-service-design.md) and plan: [`../docs/superpowers/plans/2026-06-02-phase-3-order-service.md`](../docs/superpowers/plans/2026-06-02-phase-3-order-service.md).

## Lifecycle (monotonic-rank reflector)

```
created ──(dispatch.driver.assigned)──▶ assigned ──(delivery.in_transit)──▶ in_transit ──(delivery.completed)──▶ completed
   │                                       │                                     │
   └──────────── POST /orders/{id}/cancel ─┴─────────────────────────────────────┘  (graduated authorization)
```

- **API-driven** transitions: `create`, `cancel` (authoritative).
- **Event-reflected** transitions: `assigned` → `in_transit` → `completed` (the service mirrors authoritative dispatch/tracking events; it never invents them). Reflected events only ever advance status; duplicates and out-of-order deliveries are idempotent no-ops, and a `cancelled` order is never resurrected.
- Cancellation: `created`/`assigned` by the owner or an admin; `in_transit` by an admin only (reason required). No billing, so no refund/compensation.
- Addresses are **snapshotted immutably** at creation: pickup supplied inline, dropoff resolved from the caller's saved address in user-service (service-JWT call, ownership-verified).

## API surface (via the gateway, `/v1` prefix added there)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/orders` | customer | Create an order |
| `GET` | `/orders/me` | any user | The caller's orders (cursor-paginated, `?status=`) |
| `GET` | `/orders/{id}` | owner or admin | Single order |
| `POST` | `/orders/{id}/cancel` | per matrix | Cancel (`{ reason? }`) |
| `GET` | `/orders` | admin | All orders (`?status=&customerId=`) |
| `GET` | `/healthz` · `/readyz` | none | Liveness / readiness (DB + RabbitMQ) |

Errors are RFC 7807 Problem Details. Lists return `{ items, nextCursor }`.

## Events

- **Publishes:** `order.created`, `order.status.changed`, `order.cancelled`.
- **Consumes:** `dispatch.driver.assigned` (→ assigned), `delivery.in_transit` (→ in_transit), `delivery.completed` (→ completed).

All events use the shared envelope from `@angelocp-01/logistics-contracts`. Consumers are idempotent (`processed_events` dedup) and tolerate out-of-order delivery.

## Local development

```bash
docker compose up -d            # dev Postgres on :5436
cp .env.example .env            # then fill in secrets
npm install
npm run prisma:migrate          # apply migrations to the dev DB
npm run dev                     # tsx --env-file=.env, listens on PORT (default 3003)
```

Creating an order requires user-service reachable at `ORDER_USER_SERVICE_URL` (the gateway in real deploys) for dropoff address resolution.

## Configuration

| Var | Purpose |
|---|---|
| `ORDER_DB_URL` | Postgres connection string (pooled) |
| `ORDER_JWT_SECRET` | verify inbound user JWTs (HS256) |
| `SERVICE_JWT_SECRET` | mint the outbound service JWT to user-service (must differ from `ORDER_JWT_SECRET`) |
| `ORDER_USER_SERVICE_URL` | base URL for address resolution |
| `RABBITMQ_URL` | broker |
| `LOG_LEVEL`, `LOG_SERVICE_NAME`, `PORT`, `NODE_ENV` | cross-cutting |

## Testing

```bash
npm test          # unit (domain + application + adapters), fast
npm run test:int  # integration via testcontainers (real Postgres + RabbitMQ), --runInBand
npm run typecheck && npm run lint
```

Unit tests use in-memory fakes; integration tests exercise the real wired app + event consumer against real containers (the layer that catches route-mount, ESM, and async-error bugs unit tests miss).

## Architecture

Clean Architecture: `src/{domain,application,infrastructure,interfaces,config}` + `server.ts` (composition root). Dependencies point inward; `infrastructure` implements the ports declared in `domain`/`application`. See the spec §11 for the full layout.
