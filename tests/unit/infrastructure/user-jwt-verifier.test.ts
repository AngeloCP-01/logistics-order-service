import jwt from "jsonwebtoken";

import { UserJwtVerifier, InvalidUserJwtError } from "@/infrastructure/auth/user-jwt-verifier.js";

const { sign } = jwt;

const SECRET = "a".repeat(32);

describe("UserJwtVerifier", () => {
  it("returns userId + role on valid token", () => {
    const v = new UserJwtVerifier(SECRET);
    const token = sign({ sub: "11111111-1111-7111-8111-111111111111", role: "customer" }, SECRET, { algorithm: "HS256", expiresIn: "5m" });
    const claims = v.verify(token);
    expect(claims.userId).toBe("11111111-1111-7111-8111-111111111111");
    expect(claims.role).toBe("customer");
  });

  it("rejects expired token", () => {
    const v = new UserJwtVerifier(SECRET);
    const token = sign({ sub: "11111111-1111-7111-8111-111111111111", role: "customer" }, SECRET, { algorithm: "HS256", expiresIn: "-1s" });
    expect(() => v.verify(token)).toThrow(InvalidUserJwtError);
  });

  it("rejects token signed with wrong secret", () => {
    const v = new UserJwtVerifier(SECRET);
    const token = sign({ sub: "11111111-1111-7111-8111-111111111111", role: "customer" }, "z".repeat(32), { algorithm: "HS256", expiresIn: "5m" });
    expect(() => v.verify(token)).toThrow(InvalidUserJwtError);
  });

  it("rejects token without sub", () => {
    const v = new UserJwtVerifier(SECRET);
    const token = sign({ role: "customer" }, SECRET, { algorithm: "HS256", expiresIn: "5m" });
    expect(() => v.verify(token)).toThrow(InvalidUserJwtError);
  });

  it("rejects token without role", () => {
    const v = new UserJwtVerifier(SECRET);
    const token = sign({ sub: "11111111-1111-7111-8111-111111111111" }, SECRET, { algorithm: "HS256", expiresIn: "5m" });
    expect(() => v.verify(token)).toThrow(InvalidUserJwtError);
  });

  it("rejects token with non-HS256 alg", () => {
    const v = new UserJwtVerifier(SECRET);
    const token = sign({ sub: "11111111-1111-7111-8111-111111111111", role: "customer" }, SECRET, { algorithm: "HS512", expiresIn: "5m" });
    expect(() => v.verify(token)).toThrow(InvalidUserJwtError);
  });
});
