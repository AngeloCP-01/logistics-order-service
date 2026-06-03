import jwt from "jsonwebtoken";

import { ServiceJwtSigner } from "@/infrastructure/auth/service-jwt-signer.js";

const { verify } = jwt;

describe("ServiceJwtSigner", () => {
  const secret = "s".repeat(40);

  it("mints a token for the target audience with svc subject", () => {
    const signer = new ServiceJwtSigner(secret, "order-service");
    const token = signer.sign("user-service");
    const claims = verify(token, secret, { audience: "user-service" }) as jwt.JwtPayload;
    expect(claims.sub).toBe("svc:order-service");
    expect(claims.aud).toBe("user-service");
    expect(claims.exp! - claims.iat!).toBe(300);
  });
});
