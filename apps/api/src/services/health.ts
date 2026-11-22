import type { HealthResponse, ServiceStatus } from "@callmind/shared";

export const APP_VERSION = "0.1.0";
const CHECK_TIMEOUT_MS = 2_000;
const startedAt = Date.now();

export interface HealthDependencies {
  pingMongo: () => Promise<void>;
  pingRedis: () => Promise<void>;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Health check timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function measure(check: () => Promise<void>): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await withTimeout(check(), CHECK_TIMEOUT_MS);
    return { status: "up", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "down",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function checkHealth(
  dependencies: HealthDependencies,
): Promise<HealthResponse> {
  const [mongodb, redis] = await Promise.all([
    measure(dependencies.pingMongo),
    measure(dependencies.pingRedis),
  ]);

  const allUp = mongodb.status === "up" && redis.status === "up";

  return {
    status: allUp ? "ok" : "degraded",
    service: "callmind-api",
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    services: {
      api: { status: "up" },
      mongodb,
      redis,
    },
  };
}
