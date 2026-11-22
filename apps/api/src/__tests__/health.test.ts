import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { HealthResponse } from "@callmind/shared";
import { createApp } from "../app";

const silentLogger = pino({ level: "silent" });

const healthyPayload: HealthResponse = {
  status: "ok",
  service: "callmind-api",
  version: "0.1.0",
  timestamp: new Date().toISOString(),
  uptimeSeconds: 42,
  services: {
    api: { status: "up" },
    mongodb: { status: "up", latencyMs: 3 },
    redis: { status: "up", latencyMs: 1 },
  },
};

function buildApp(getHealth: () => Promise<HealthResponse>) {
  return createApp({
    getHealth,
    corsOrigins: ["http://localhost:5174"],
    logger: silentLogger,
  });
}

describe("GET /api/health", () => {
  it("returns 200 and a valid payload when dependencies are up", async () => {
    const response = await request(buildApp(async () => healthyPayload)).get(
      "/api/health",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.services.mongodb.status).toBe("up");
    expect(response.body.services.redis.status).toBe("up");
  });

  it("returns 503 when a dependency is down", async () => {
    const degraded: HealthResponse = {
      ...healthyPayload,
      status: "degraded",
      services: {
        ...healthyPayload.services,
        redis: { status: "down", error: "connection refused" },
      },
    };

    const response = await request(buildApp(async () => degraded)).get(
      "/api/health",
    );

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.services.redis.status).toBe("down");
  });

  it("returns 404 for unknown API routes", async () => {
    const response = await request(buildApp(async () => healthyPayload)).get(
      "/api/does-not-exist",
    );

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe("Route not found");
  });
});
