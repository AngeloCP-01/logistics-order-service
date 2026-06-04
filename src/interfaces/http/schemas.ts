import { z } from "zod";

const addressInput = z.object({
  label: z.string().min(1).optional(),
  street: z.string().min(1),
  city: z.string().min(1),
  country: z.string().regex(/^[A-Za-z]{2}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const itemInput = z.object({
  description: z.string().min(1),
  quantity: z.number().int().min(1),
  weightKg: z.number().positive().optional(),
});

export const createOrderSchema = z.object({
  pickup: addressInput,
  dropoffAddressId: z.string().uuid(),
  items: z.array(itemInput).min(1),
  scheduledFor: z
    .string()
    .datetime()
    .optional()
    .refine((v) => v === undefined || new Date(v).getTime() > Date.now(), {
      message: "scheduledFor must be in the future",
    }),
});

export const cancelOrderSchema = z.object({ reason: z.string().min(1).optional() });

const orderStatus = z.enum(["created", "assigned", "in_transit", "completed", "cancelled"]);

export const listQuerySchema = z.object({
  status: orderStatus.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminListQuerySchema = listQuerySchema.extend({
  customerId: z.string().uuid().optional(),
});
