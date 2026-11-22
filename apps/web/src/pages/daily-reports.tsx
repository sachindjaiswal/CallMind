import type {
  DailyReportConflictDecision,
  DailyReportDto,
} from "@callmind/shared";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReportDetail } from "@/components/daily-reports/report-detail";
import { ReportGenerator } from "@/components/daily-reports/report-generator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import {
  fetchDailyReport,
  fetchDailyReports,
  regenerateDailyReport,
  reviewDailyReportConflict,
} from "@/lib/api";

export default function DailyReportsPage() {
  const [reports, setReports] = useState<DailyReportDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetchDailyReports({ limit: 50 });
      setReports(response.items);
      setSelectedId((current) =>
        current && response.items.some((item) => item.id === current)
          ? current
          : (response.items[0]?.id ?? null),
      );
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load daily reports.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? null,
    [reports, selectedId],
  );

  const active = selected?.status === "queued" || selected?.status === "generating";

  useEffect(() => {
    if (!active || !selectedId) {
      return;
    }

    const interval = setInterval(() => {
      void (async () => {
        try {
          const latest = await fetchDailyReport(selectedId);
          setReports((current) =>
            current.map((item) => (item.id === latest.id ? latest : item)),
          );
        } catch {
          void refresh();
        }
      })();
    }, 2_000);

    return () => clearInterval(interval);
  }, [active, selectedId, refresh]);

  const upsert = (report: DailyReportDto): void => {
    setReports((current) => [report, ...current.filter((item) => item.id !== report.id)]);
    setSelectedId(report.id);
  };

  const handleRegenerate = async (report: DailyReportDto): Promise<void> => {
    setError(null);
    try {
      upsert(await regenerateDailyReport(report.id));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not regenerate report.",
      );
    }
  };

  const handleConflictDecision = async (
    conflictId: string,
    decision: DailyReportConflictDecision,
  ): Promise<void> => {
    if (!selected) {
      return;
    }
    setError(null);
    await reviewDailyReportConflict(selected.id, conflictId, decision);
    upsert(await fetchDailyReport(selected.id));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily reports</h1>
          <p className="text-sm text-muted-foreground">
            Consolidate selected recordings for one date, review links and conflicts, and keep source evidence intact.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw />
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <ReportGenerator onGenerated={upsert} />

          <Card>
            <CardHeader>
              <CardTitle>Report history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <p className="text-xs text-muted-foreground">Loading reports…</p>
              ) : reports.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No daily reports have been generated yet.
                </p>
              ) : (
                reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setSelectedId(report.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      report.id === selectedId
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{report.reportDate}</span>
                      <Badge variant="outline">{report.timezone}</Badge>
                      <Badge
                        variant={
                          report.status === "completed"
                            ? "success"
                            : report.status === "failed"
                              ? "destructive"
                              : "warning"
                        }
                      >
                        {report.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {report.selectedRecordingIds.length} recording
                      {report.selectedRecordingIds.length === 1 ? "" : "s"} ·{" "}
                      {formatDateTime(report.createdAt)}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <ReportDetail
              report={selected}
              onRegenerate={(report) => void handleRegenerate(report)}
              onConflictDecision={handleConflictDecision}
            />
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Generate a report or select one from history.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
