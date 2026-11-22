import { Redis } from "ioredis";
import type { Logger } from "pino";

export function createRedis(url: string, logger: Logger): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  client.on("ready", () => {
    logger.info("Redis ready");
  });
  client.on("error", (error: unknown) => {
    logger.error({ err: error }, "Redis connection error");
  });

  return client;
}

export async function pingRedis(client: Redis): Promise<void> {
  const response = await client.ping();
  if (response !== "PONG") {
    throw new Error(`Unexpected Redis PING response: ${String(response)}`);
  }
}
