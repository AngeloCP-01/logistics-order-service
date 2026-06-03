import express, { type Express } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import type { Logger } from "pino";
import { requestId } from "./interfaces/http/middleware/request-id.js";
import { errorMapper } from "./interfaces/http/middleware/error-mapper.js";
import { mountOrderRoutes, type RouteDeps } from "./interfaces/http/routes.js";
import type { HealthController } from "./interfaces/http/controllers/health-controller.js";

export interface AppDeps extends RouteDeps {
  logger: Logger;
  health: HealthController;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(requestId());
  app.use(
    pinoHttp({
      logger: deps.logger,
      customProps: (req) => ({ requestId: (req as { requestId?: string }).requestId }),
      redact: {
        paths: ["req.headers.authorization", "req.headers['x-service-authorization']", "req.headers.cookie"],
        remove: true,
      },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.get("/healthz", deps.health.healthz);
  app.get("/readyz", deps.health.readyz);
  mountOrderRoutes(app, { userJwt: deps.userJwt, orders: deps.orders });
  app.use(errorMapper());
  return app;
}
