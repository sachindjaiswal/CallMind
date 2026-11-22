import { z } from "zod";

export const serviceStatusSchema = z.object({
  status: z.enum(["up", "down"]),
  latencyMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
});

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string().min(1),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
  services: z.object({
    api: serviceStatusSchema,
    mongodb: serviceStatusSchema,
    redis: serviceStatusSchema,
  }),
});

export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
