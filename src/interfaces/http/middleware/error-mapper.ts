import type { ErrorRequestHandler } from "express";
import "pino-http";
import { ZodError } from "zod";
import { DomainError, ValidationError } from "../../../domain/shared/errors.js";

export function errorMapper(): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (res.headersSent) return;
    const requestId = req.requestId ?? "unknown";

    if (err instanceof ZodError) {
      const ve = new ValidationError(
        err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      );
      return res.status(400).type("application/problem+json").json({
        type: "urn:logistics:order:validation_failed",
        title: ve.message,
        status: 400,
        detail: ve.message,
        instance: requestId,
        errors: ve.errors,
      });
    }

    if (err instanceof DomainError) {
      const body: Record<string, unknown> = {
        type: `urn:logistics:order:${err.code}`,
        title: err.message,
        status: err.status,
        detail: err.message,
        instance: requestId,
      };
      if (err instanceof ValidationError) body.errors = err.errors;
      return res.status(err.status).type("application/problem+json").json(body);
    }

    req.log?.error({ err }, "unhandled_error");
    return res.status(500).type("application/problem+json").json({
      type: "urn:logistics:order:internal",
      title: "Internal Server Error",
      status: 500,
      instance: requestId,
    });
  };
}
