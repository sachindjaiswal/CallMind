import {
  DAILY_REPORT_MAX_PAGE_LIMIT,
  type DailyReportDto,
  type DailyReportStatus,
} from "@callmind/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDailyReport, fetchDailyReports } from "@/lib/api";

const POLL_INTERVAL_MS = 2_000;

export function isActiveReportStatus(status: DailyReportStatus): boolean {
  return status === "queued" || status === "generating";
}

function newestFirst(reports: DailyReportDto[]): DailyReportDto[] {
  return [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function selectTimezoneForReports(
  reports: DailyReportDto[],
  preferredTimezone: string,
): string {
  if (reports.some((report) => report.timezone === preferredTimezone)) {
    return preferredTimezone;
  }

  const sorted = newestFirst(reports);
  const completed = sorted.find((report) => report.status === "completed");
  if (completed) {
    return completed.timezone;
  }

  const active = sorted.find((report) => isActiveReportStatus(report.status));
  if (active) {
    return active.timezone;
  }

  const failed = sorted.find((report) => report.status === "failed");
  if (failed) {
    return failed.timezone;
  }

  return preferredTimezone;
}

export function selectDefaultReport(
  versions: DailyReportDto[],
): DailyReportDto | null {
  const sorted = newestFirst(versions);
  return (
    sorted.find((report) => report.status === "completed") ??
    sorted.find((report) => isActiveReportStatus(report.status)) ??
    sorted.find((report) => report.status === "failed") ??
    null
  );
}

export function findCompletedReportFallback(
  reports: DailyReportDto[],
  currentReportDate: string,
): DailyReportDto | null {
  return (
    newestFirst(
      reports.filter(
        (report) =>
          report.status === "completed" &&
          report.reportDate !== currentReportDate,
      ),
    )[0] ?? null
  );
}

export function selectReportForState(
  versions: DailyReportDto[],
  selectedId: string | null,
): DailyReportDto | null {
  if (selectedId) {
    const selected = versions.find((report) => report.id === selectedId);
    if (selected) {
      return selected;
    }
  }

  return selectDefaultReport(versions);
}

export interface UseDashboardReportOptions {
  reportDate: string;
  preferredTimezone: string;
  allowCompletedFallback?: boolean;
  onFallbackDateChange?: (reportDate: string) => void;
}

export interface UseDashboardReportResult {
  reports: DailyReportDto[];
  versions: DailyReportDto[];
  availableTimezones: string[];
  activeTimezone: string;
  selectedReport: DailyReportDto | null;
  selectedReportId: string | null;
  selectReport: (id: string) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboardReport({
  reportDate,
  preferredTimezone,
  allowCompletedFallback = false,
  onFallbackDateChange,
}: UseDashboardReportOptions): UseDashboardReportResult {
  const [reports, setReports] = useState<DailyReportDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);

  const hasLoadedRef = useRef(false);
  const listInFlightRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const detailInFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const latestDateRef = useRef(reportDate);
  const latestTimezoneRef = useRef(preferredTimezone);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  latestDateRef.current = reportDate;
  latestTimezoneRef.current = preferredTimezone;

  const refresh = useCallback(async (): Promise<void> => {
    if (!reportDate) {
      setReports([]);
      setSelectedId(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (listInFlightRef.current) {
      queuedRefreshRef.current = true;
      return;
    }

    listInFlightRef.current = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const requestDate = reportDate;
    const requestTimezone = preferredTimezone;
    setPollKey((current) => current + 1);

    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const isStale = (): boolean =>
      requestId !== requestIdRef.current ||
      latestDateRef.current !== requestDate ||
      latestTimezoneRef.current !== requestTimezone;

    let fallbackReportDate: string | null = null;

    try {
      const response = await fetchDailyReports({
        reportDate: requestDate,
        limit: DAILY_REPORT_MAX_PAGE_LIMIT,
      });

      if (isStale()) {
        return;
      }

      if (
        allowCompletedFallback &&
        onFallbackDateChange &&
        !response.items.some((report) => report.status === "completed")
      ) {
        try {
          const fallbackResponse = await fetchDailyReports({
            status: "completed",
            limit: DAILY_REPORT_MAX_PAGE_LIMIT,
          });

          if (isStale()) {
            return;
          }

          const fallbackReport = findCompletedReportFallback(
            fallbackResponse.items,
            requestDate,
          );
          if (fallbackReport) {
            fallbackReportDate = fallbackReport.reportDate;
          }
        } catch {
          fallbackReportDate = null;
        }
      }

      if (fallbackReportDate) {
        return;
      }

      const nextReports = response.items;
      const nextTimezone = selectTimezoneForReports(
        nextReports,
        requestTimezone,
      );
      const nextVersions = nextReports.filter(
        (report) => report.timezone === nextTimezone,
      );

      setReports(nextReports);
      setSelectedId((current) =>
        current && nextVersions.some((report) => report.id === current)
          ? current
          : null,
      );
      setError(null);
    } catch (caught) {
      if (requestId === requestIdRef.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load the daily report.",
        );
      }
    } finally {
      listInFlightRef.current = false;

      if (fallbackReportDate) {
        hasLoadedRef.current = false;
        setReports([]);
        setSelectedId(null);
        setError(null);
        setLoading(true);
        setRefreshing(false);
        onFallbackDateChange?.(fallbackReportDate);
      } else {
        hasLoadedRef.current = true;
        setLoading(false);
        setRefreshing(false);

        if (queuedRefreshRef.current) {
          queuedRefreshRef.current = false;
          void refreshRef.current();
        }
      }
    }
  }, [
    allowCompletedFallback,
    onFallbackDateChange,
    preferredTimezone,
    reportDate,
  ]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    setSelectedId(null);
    setReports([]);
    setError(null);
    hasLoadedRef.current = false;
    void refresh();
  }, [refresh]);

  const availableTimezones = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const report of newestFirst(reports)) {
      if (!seen.has(report.timezone)) {
        seen.add(report.timezone);
        ordered.push(report.timezone);
      }
    }
    return ordered;
  }, [reports]);

  const activeTimezone = useMemo(
    () => selectTimezoneForReports(reports, preferredTimezone),
    [preferredTimezone, reports],
  );

  const versions = useMemo(
    () =>
      newestFirst(
        reports.filter((report) => report.timezone === activeTimezone),
      ),
    [activeTimezone, reports],
  );

  const selectedReport = useMemo(
    () => selectReportForState(versions, selectedId),
    [selectedId, versions],
  );

  const selectedReportId = selectedReport?.id ?? null;
  const selectedStatus = selectedReport?.status;

  useEffect(() => {
    if (selectedId && !versions.some((report) => report.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, versions]);

  useEffect(() => {
    if (!selectedReportId || !selectedStatus || !isActiveReportStatus(selectedStatus)) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async (): Promise<void> => {
      if (detailInFlightRef.current) {
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        return;
      }

      detailInFlightRef.current = true;
      try {
        const latest = await fetchDailyReport(selectedReportId);
        if (cancelled) {
          return;
        }
        setReports((current) =>
          current.map((report) => (report.id === latest.id ? latest : report)),
        );
        setError(null);
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not refresh the daily report.",
          );
        }
      } finally {
        detailInFlightRef.current = false;
      }
    };

    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [pollKey, selectedReportId, selectedStatus]);

  const selectReport = useCallback(
    (id: string): void => {
      if (versions.some((report) => report.id === id)) {
        setSelectedId(id);
        setError(null);
      }
    },
    [versions],
  );

  return {
    reports,
    versions,
    availableTimezones,
    activeTimezone,
    selectedReport,
    selectedReportId,
    selectReport,
    loading,
    refreshing,
    error,
    refresh,
  };
}
