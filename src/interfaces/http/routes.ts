import { Router, type Express } from "express";
import { userAuth } from "./middleware/user-auth.js";
import { requireRole } from "./middleware/role-guard.js";
import type { UserJwtVerifier } from "../../infrastructure/auth/user-jwt-verifier.js";
import type { OrderController } from "./controllers/order-controller.js";

export interface RouteDeps {
  userJwt: UserJwtVerifier;
  orders: OrderController;
}

export function mountOrderRoutes(app: Express, deps: RouteDeps): void {
  const r = Router();
  r.use(userAuth(deps.userJwt));
  r.get("/orders/me", deps.orders.listMine); // before /orders/:id
  r.post("/orders", deps.orders.create);
  r.get("/orders", requireRole(["admin"]), deps.orders.listAdmin);
  r.get("/orders/:id", deps.orders.getById);
  r.post("/orders/:id/cancel", deps.orders.cancel);
  app.use(r);
}
