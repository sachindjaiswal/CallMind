import {
  DAILY_REPORT_DEFAULT_TIMEZONE,
  getDateInTimeZone,
  type DailyReportDto,
} from "@callmind/shared";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecordings } from "@/hooks/use-recordings";
import { generateDailyReport } from "@/lib/api";

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
];

interface ReportGeneratorProps {
  onGenerated: (report: DailyReportDto) => void;
}

export function ReportGenerator({ onGenerated }: ReportGeneratorProps) {
  const recordings = useRecordings(5_000, 100);
  const [reportDate, setReportDate] = useState(() => getDateInTimeZone(new Date(), "UTC"));
  const [timezone, setTimezone] = useState(DAILY_REPORT_DEFAULT_TIMEZONE);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = recordings.items.filter(
    (item) => item.status === "analysis_completed",
  );

  const toggle = (id: string): void => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const report = await generateDailyReport({
        reportDate,
        timezone,
        recordingIds: selectedIds,
      });
      setSelectedIds([]);
      onGenerated(report);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not generate the daily report.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate daily report</CardTitle>
        <CardDescription>
          Select completed recordings and an explicit reporting date and timezone. No other recordings are included.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Reporting date</span>
            <input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Timezone</span>
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              {TIMEZONES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Selected recordings</p>
            <Badge variant="secondary">{selectedIds.length} selected</Badge>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
            {recordings.loading ? (
              <p className="text-xs text-muted-foreground">Loading recordings…</p>
            ) : eligible.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No recordings have completed analysis yet.
              </p>
            ) : (
              eligible.map((recording) => (
                <label
                  key={recording.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(recording.id)}
                    onChange={() => toggle(recording.id)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {recording.originalFilename}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {recording.id} · {new Date(recording.createdAt).toLocaleString()}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          {recordings.error ? (
            <p className="text-xs text-destructive">{recordings.error}</p>
          ) : null}
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <Button
          onClick={() => void submit()}
          disabled={submitting || selectedIds.length === 0 || !reportDate || !timezone}
        >
          {submitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          Generate report
        </Button>
      </CardContent>
    </Card>
  );
}
