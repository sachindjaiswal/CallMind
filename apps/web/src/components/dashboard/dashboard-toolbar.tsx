import type { DailyReportDto } from "@callmind/shared";
import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

interface DashboardToolbarProps {
  reportDate: string;
  onReportDateChange: (value: string) => void;
  activeTimezone: string;
  timezones: string[];
  onTimezoneChange: (value: string) => void;
  versions: DailyReportDto[];
  selectedReportId: string | null;
  onSelectReport: (id: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function DashboardToolbar({
  reportDate,
  onReportDateChange,
  activeTimezone,
  timezones,
  onTimezoneChange,
  versions,
  selectedReportId,
  onSelectReport,
  onRefresh,
  refreshing,
}: DashboardToolbarProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="dashboard-report-date" className="text-xs font-medium">
              Reporting date
            </label>
            <input
              id="dashboard-report-date"
              type="date"
              value={reportDate}
              onChange={(event) => onReportDateChange(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          {timezones.length > 1 ? (
            <div className="space-y-1.5">
              <label
                htmlFor="dashboard-timezone"
                className="text-xs font-medium"
              >
                Timezone
              </label>
              <select
                id="dashboard-timezone"
                value={activeTimezone}
                onChange={(event) => onTimezoneChange(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {versions.length > 1 ? (
            <div className="space-y-1.5">
              <label
                htmlFor="dashboard-report-version"
                className="text-xs font-medium"
              >
                Report version
              </label>
              <select
                id="dashboard-report-version"
                value={selectedReportId ?? ""}
                onChange={(event) => onSelectReport(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.status} · {formatDateTime(version.createdAt)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Read-only daily intelligence. Manage generation and conflict review
            in Daily reports.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={refreshing ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"}
              />
              Refresh
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/daily-reports">Daily reports</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
