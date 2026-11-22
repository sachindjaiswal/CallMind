import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./health";

const healthyPayload = {
  status: "ok",
  service: "callmind-api",
  version: "0.1.0",
  timestamp: new Date().toISOString(),
  uptimeSeconds: 12,
  services: {
    api: { status: "up" },
    mongodb: { status: "up", latencyMs: 4 },
    redis: { status: "up", latencyMs: 1 },
  },
};

describe("healthResponseSchema", () => {
  it("accepts a valid health payload", () => {
    expect(healthResponseSchema.parse(healthyPayload).status).toBe("ok");
  });

  it("rejects an invalid status value", () => {
    const result = healthResponseSchema.safeParse({
      ...healthyPayload,
      status: "healthy",
    });
    expect(result.success).toBe(false);
  });

  it("requires all three service checks", () => {
    const result = healthResponseSchema.safeParse({
      ...healthyPayload,
      services: { api: { status: "up" } },
    });
    expect(result.success).toBe(false);
  });
});
