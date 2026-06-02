# logistics-order-service — Repo Guide

> Order CRUD, lifecycle state machine, order history, delivery scheduling.

**Phase:** 3 (Order Service)
**Status:** ⬜ Not started — scaffold only. Brainstorm an Order spec before implementation.

## What this service does

Owns the order aggregate. Creates orders, drives them through their lifecycle (created → assigned → in_transit → completed / cancelled), records history, schedules future deliveries. Publishes lifecycle events; consumes dispatch and delivery events to advance its own state.

## Locked decisions

- **Tech**: Node 20 LTS, TypeScript, Express, Prisma + Neon Postgres, Jest.
- **Events published**: `order.created`, `order.status.changed`, `order.cancelled`.
- **Events consumed**: `dispatch.driver.assigned` (move to `assigned`), `delivery.completed` (move to `completed`).
- **Sync HTTP outbound**: → `user-service` `/users/{id}/addresses/{addressId}` (resolve customer address at order creation). Through gateway, with service JWT.
- **Public endpoints** (via gateway): `/v1/orders`, `/v1/orders/{id}`, `/v1/orders/{id}/cancel`, `/v1/orders/me`, `/healthz`, `/readyz`.

## Database (Neon Postgres)

Tables (finalized in Order spec):
- `orders` — id, customer_id, pickup_address (denormalized at creation), dropoff_address (denormalized), status (enum), assigned_driver_id (nullable), scheduled_for (nullable), created_at, updated_at.
- `order_items` — id, order_id, description, qty, weight_kg (optional).
- `order_status_history` — id, order_id, from_status, to_status, reason, changed_by (user/system), changed_at.

## Lifecycle (V1 draft — finalized in Order spec)

```
created → assigned → in_transit → completed
        ↓          ↓             ↓
      cancelled  cancelled    (terminal)
```

- `created → cancelled`: customer-initiated, before assignment.
- `assigned → cancelled`: customer or admin, before pickup; triggers driver re-dispatch.
- `in_transit → cancelled`: admin only, with reason.

## Conventions

- Same as platform: pino, Zod, `/healthz` + `/readyz`, RFC 7807, Conventional Commits.
- Env prefix: `ORDER_*`.
- Addresses are **snapshotted** at order creation. We do NOT join to `user-service.addresses` later — that table can change but historical orders should not.
- Status transitions are recorded in `order_status_history` atomically with the `orders` row update.

## Open items (decide in the Order spec)

- Full state machine + every invalid transition (exhaustive table)
- Scheduling rules (how far ahead can a customer schedule? cancellation window? reminders?)
- Cancellation refund / driver compensation policy
- Order item schema (do we model SKUs, prices, weight, dims? V1: free-text + qty?)
- Whether to support multi-stop orders in V1 (proposal: no — V1 is single pickup + dropoff)

## Don't do

- Don't allow status transitions outside the state machine. Always go through a use-case that validates the transition.
- Don't write to `orders` outside of a transaction that also writes `order_status_history`.
- Don't query `user-service.addresses` to refresh an existing order's address. Snapshot at creation; treat as immutable.
- Don't assign a driver here. That's `dispatch-service`'s job. Consume `dispatch.driver.assigned` to learn about assignments.

## Pointers

- Spec: [`../docs/superpowers/specs/2026-05-18-platform-decomposition-design.md`](../docs/superpowers/specs/2026-05-18-platform-decomposition-design.md) §4.1, §4.3
- Plan: TBD (brainstorm + plan in Phase 3)
- Tracker: [`../docs/superpowers/tracker.md`](../docs/superpowers/tracker.md)
