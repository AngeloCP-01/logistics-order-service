export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly status: number;
}

export class ValidationError extends DomainError {
  readonly code = "validation_failed";
  readonly status = 400;
  constructor(public readonly errors: { field: string; message: string }[]) {
    super("Validation failed");
  }
}

export class NotFoundError extends DomainError {
  readonly code = "not_found";
  readonly status = 404;
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`);
  }
}

export class ConflictError extends DomainError {
  readonly code = "conflict";
  readonly status = 409;
  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = "unauthorized";
  readonly status = 401;
  constructor(message = "unauthorized") {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = "forbidden";
  readonly status = 403;
  constructor(message = "forbidden") {
    super(message);
  }
}

export class UnprocessableEntityError extends DomainError {
  readonly code = "unprocessable_entity";
  readonly status = 422;
  constructor(message: string) {
    super(message);
  }
}

export class RoleRequiredError extends ForbiddenError {
  constructor(required: string, actual: string) {
    super(`requires role ${required}, got ${actual}`);
  }
}

export class InvariantViolationError extends DomainError {
  readonly code = "invariant_violation";
  readonly status = 400;
  constructor(message: string) {
    super(message);
  }
}

export class InvalidOrderTransitionError extends ConflictError {
  constructor(from: string, to: string) {
    super(`cannot transition order from ${from} to ${to}`);
  }
}

export class OrderNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("order", id);
  }
}
