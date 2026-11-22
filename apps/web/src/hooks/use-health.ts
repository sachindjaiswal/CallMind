import { useCallback, useEffect, useState } from "react";

export type HealthStatus = "loading" | "ok" | "degraded" | "offline";

export interface HealthSnapshot {
  status: HealthStatus;
  mongodb?: "up" | "down";
  redis?: "up" | "down";
  checkedAt?: string;
}

interface ApiHealthResponse {
  status: "ok" | "degraded";
  services: {
    mongodb: { status: "up" | "down" };
    redis: { status: "up" | "down" };
  };
}

export function useHealth(pollMs = 20_000) {
  const [snapshot, setSnapshot] = useState<HealthSnapshot>({
    status: "loading",
  });

  const check = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch("/api/health", {
        signal,
        headers: { Accept: "application/json" },
      });
      const body = (await response.json()) as ApiHealthResponse;

      setSnapshot({
        status: response.ok ? "ok" : "degraded",
        mongodb: body.services?.mongodb?.status,
        redis: body.services?.redis?.status,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setSnapshot({ status: "offline" });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);

    const interval = setInterval(() => {
      void check(controller.signal);
    }, pollMs);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [check, pollMs]);

  return snapshot;
}
