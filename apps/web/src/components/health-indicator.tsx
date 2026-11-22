import { cn } from "@/lib/utils";
import { useHealth } from "@/hooks/use-health";

const toneByStatus = {
  loading: "bg-muted-foreground/40",
  ok: "bg-emerald-500",
  degraded: "bg-amber-500",
  offline: "bg-rose-500",
} as const;

const labelByStatus = {
  loading: "Checking services",
  ok: "All systems operational",
  degraded: "Degraded services",
  offline: "API offline",
} as const;

export function HealthIndicator() {
  const health = useHealth();

  const detail =
    health.status === "ok"
      ? "MongoDB + Redis connected"
      : health.status === "degraded"
        ? `MongoDB ${health.mongodb ?? "?"} · Redis ${health.redis ?? "?"}`
        : health.status === "offline"
          ? "Cannot reach /api/health"
          : "Connecting to API";

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2">
      <span className="relative flex h-2 w-2 shrink-0">
        {health.status === "loading" ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted-foreground/40" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            toneByStatus[health.status],
          )}
        />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">
          {labelByStatus[health.status]}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
