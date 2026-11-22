import type { DailyReportError, DailyReportStatus } from "@callmind/shared";
import {
  AlertTriangle,
  CalendarRange,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export function DashboardLoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading daily intelligence…
    </div>
  );
}

export function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Could not load the dashboard"
      description={message}
    >
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1 h-4 w-4" />
        Try again
      </Button>
    </EmptyState>
  );
}

export function DashboardNoReportState({
  reportDate,
  timezone,
}: {
  reportDate: string;
  timezone: string;
}) {
  return (
    <EmptyState
      icon={CalendarRange}
      title="No daily report for this date"
      description={`No report exists for ${reportDate} in ${timezone}. Create one in Daily reports, then return here to explore its intelligence.`}
    >
      <Button asChild>
        <Link to="/daily-reports">Open Daily reports</Link>
      </Button>
    </EmptyState>
  );
}

export function DashboardGeneratingState({
  status,
}: {
  status: Extract<DailyReportStatus, "queued" | "generating">;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>
          {status === "queued"
            ? "This report is queued for generation."
            : "This report is being generated."}{" "}
          The dashboard refreshes automatically.
        </span>
      </CardContent>
    </Card>
  );
}

export function DashboardFailedState({
  error,
}: {
  error: DailyReportError | null;
}) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Report generation failed
        </div>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? "The daily report could not be generated."}
        </p>
        {error ? (
          <p className="text-xs text-muted-foreground">
            {error.code}
            {error.retryable ? " · retryable" : ""}
          </p>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <Link to="/daily-reports">Manage reports</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function DashboardNoInsightsState() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        No consolidated insights are available for this report.
      </CardContent>
    </Card>
  );
}

export function DashboardRefreshError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
      <span>{message}</span>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1 h-3 w-3" />
        Retry
      </Button>
    </div>
  );
}
