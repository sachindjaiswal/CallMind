import {
  getDateInTimeZone,
  type ReportEvidence,
} from "@callmind/shared";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EvidenceDrawer } from "@/components/daily-reports/evidence-drawer";
import { ConflictsSection } from "@/components/dashboard/conflicts-section";
import { DashboardToolbar } from "@/components/dashboard/dashboard-toolbar";
import {
  DashboardErrorState,
  DashboardFailedState,
  DashboardGeneratingState,
  DashboardLoadingState,
  DashboardNoInsightsState,
  DashboardNoReportState,
  DashboardRefreshError,
} from "@/components/dashboard/dashboard-states";
import { RecordingCard } from "@/components/dashboard/recording-card";
import { RelationshipsSection } from "@/components/dashboard/relationships-section";
import { ReportSummaryCard } from "@/components/dashboard/report-summary-card";
import { useDashboardReport } from "@/hooks/use-dashboard-report";
import { useRecordingDetails } from "@/hooks/use-recording-details";

function resolveBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function DashboardPage() {
  const browserTimezone = useMemo(resolveBrowserTimezone, []);
  const [reportDate, setReportDate] = useState(() =>
    getDateInTimeZone(new Date(), browserTimezone),
  );
  const [preferredTimezone, setPreferredTimezone] = useState(browserTimezone);
  const [hasExplicitDate, setHasExplicitDate] = useState(false);
  const [evidence, setEvidence] = useState<ReportEvidence[] | null>(null);
  const navigate = useNavigate();

  const handleReportDateChange = useCallback((value: string): void => {
    setHasExplicitDate(true);
    setReportDate(value);
  }, []);

  const handleFallbackDateChange = useCallback((value: string): void => {
    setReportDate(value);
  }, []);

  const dashboard = useDashboardReport({
    reportDate,
    preferredTimezone,
    allowCompletedFallback: !hasExplicitDate,
    onFallbackDateChange: handleFallbackDateChange,
  });

  const selected = dashboard.selectedReport;
  const recordingIds = useMemo(
    () => selected?.sourceRecordings.map((item) => item.recordingId) ?? [],
    [selected?.sourceRecordings],
  );
  const recordingDetails = useRecordingDetails(recordingIds);

  const fallbackTimezone =
    dashboard.availableTimezones.length > 0 &&
    !dashboard.availableTimezones.includes(preferredTimezone)
      ? dashboard.activeTimezone
      : null;

  const handleOpenSourceRecording = (item: ReportEvidence): void => {
    setEvidence(null);

    const params = new URLSearchParams({
      recordingId: item.recordingId,
    });
    if (item.segmentId) {
      params.set("segmentId", item.segmentId);
    }
    if (item.segmentIndex !== null) {
      params.set("segmentIndex", String(item.segmentIndex));
    }
    if (Number.isFinite(item.start)) {
      params.set("start", String(item.start));
    }

    navigate(`/recordings?${params.toString()}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A read-only, content-driven view of the intelligence in your daily
          report.
        </p>
      </div>

      <DashboardToolbar
        reportDate={reportDate}
        onReportDateChange={handleReportDateChange}
        activeTimezone={dashboard.activeTimezone}
        timezones={dashboard.availableTimezones}
        onTimezoneChange={setPreferredTimezone}
        versions={dashboard.versions}
        selectedReportId={dashboard.selectedReportId}
        onSelectReport={dashboard.selectReport}
        onRefresh={() => void dashboard.refresh()}
        refreshing={dashboard.refreshing}
      />

      {fallbackTimezone ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          No report exists in {preferredTimezone} for {reportDate}. Showing the
          newest available report in {fallbackTimezone}.
        </p>
      ) : null}

      {dashboard.error && selected ? (
        <DashboardRefreshError
          message={dashboard.error}
          onRetry={() => void dashboard.refresh()}
        />
      ) : null}

      {recordingDetails.error && selected ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {recordingDetails.error}
        </p>
      ) : null}

      {dashboard.loading && !selected ? (
        <DashboardLoadingState />
      ) : dashboard.error && !selected ? (
        <DashboardErrorState
          message={dashboard.error}
          onRetry={() => void dashboard.refresh()}
        />
      ) : !selected ? (
        <DashboardNoReportState
          reportDate={reportDate}
          timezone={dashboard.activeTimezone}
        />
      ) : (
        <>
          <ReportSummaryCard report={selected} />

          {selected.status === "queued" || selected.status === "generating" ? (
            <DashboardGeneratingState status={selected.status} />
          ) : null}

          {selected.status === "failed" ? (
            <DashboardFailedState error={selected.error} />
          ) : null}

          {selected.sourceRecordings.length > 0 ? (
            <section aria-labelledby="dashboard-calls-heading" className="space-y-4">
              <div className="flex items-center gap-2">
                <h2
                  id="dashboard-calls-heading"
                  className="text-base font-semibold"
                >
                  Calls
                </h2>
                <span className="text-xs text-muted-foreground">
                  {selected.sourceRecordings.length}
                </span>
              </div>
              {selected.sourceRecordings.map((source) => (
                <RecordingCard
                  key={source.recordingId}
                  source={source}
                  recording={recordingDetails.details[source.recordingId] ?? null}
                  report={selected}
                  loading={recordingDetails.loading}
                  onViewEvidence={setEvidence}
                />
              ))}
            </section>
          ) : null}

          {selected.status === "completed" &&
          selected.sourceRecordings.length === 0 &&
          selected.consolidatedInsights.length === 0 ? (
            <DashboardNoInsightsState />
          ) : null}

          <RelationshipsSection
            relationships={selected.relationships}
            onViewEvidence={setEvidence}
          />
          <ConflictsSection
            conflicts={selected.conflicts}
            onViewEvidence={setEvidence}
          />
        </>
      )}

      {evidence ? (
        <EvidenceDrawer
          evidence={evidence}
          onClose={() => setEvidence(null)}
          onOpenSourceRecording={handleOpenSourceRecording}
        />
      ) : null}
    </div>
  );
}
