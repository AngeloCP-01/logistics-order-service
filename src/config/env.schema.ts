import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.coerce.number().int().min(1).max(65535),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
    LOG_SERVICE_NAME: z.string().min(1),
    ORDER_DB_URL: z.string().url(),
    ORDER_JWT_SECRET: z.string().min(32),
    SERVICE_JWT_SECRET: z.string().min(32),
    ORDER_USER_SERVICE_URL: z.string().url(),
    RABBITMQ_URL: z.string().url(),
  })
  .refine((env) => env.ORDER_JWT_SECRET !== env.SERVICE_JWT_SECRET, {
    message: "ORDER_JWT_SECRET and SERVICE_JWT_SECRET must be distinct values",
    path: ["SERVICE_JWT_SECRET"],
  });

export type Env = z.infer<typeof envSchema>;
