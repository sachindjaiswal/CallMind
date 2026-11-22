import type { DailyReportDto } from "@callmind/shared";
import { describe, expect, it } from "vitest";
import {
  findCompletedReportFallback,
  selectDefaultReport,
  selectReportForState,
  selectTimezoneForReports,
} from "./use-dashboard-report";

function report(
  id: string,
  status: DailyReportDto["status"],
  timezone: string,
  createdAt: string,
  reportDate = "2026-11-21",
): DailyReportDto {
  return {
    id,
    workspaceId: "default",
    reportDate,
    timezone,
    status,
    selectedRecordingIds: [],
    sourceRecordings: [],
    sourceAnalysisIds: [],
    overallSummary: "",
    consolidatedInsights: [],
    relationships: [],
    conflicts: [],
    provider: "system",
    model: "deterministic-v1",
    schemaVersion: "daily-report-v1",
    generationVersion: "deterministic-v1",
    requestFingerprint: id,
    previousReportId: null,
    attempts: 0,
    error: null,
    generatedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("dashboard report selection", () => {
  it("selects the newest completed report by default", () => {
    const reports = [
      report("failed", "failed", "UTC", "2026-11-21T12:00:00.000Z"),
      report("active", "generating", "UTC", "2026-11-21T11:00:00.000Z"),
      report("completed", "completed", "UTC", "2026-11-21T10:00:00.000Z"),
    ];

    expect(selectDefaultReport(reports)?.id).toBe("completed");
  });

  it("falls back to newest active, then failed", () => {
    expect(
      selectDefaultReport([
        report("failed", "failed", "UTC", "2026-11-21T12:00:00.000Z"),
        report("queued", "queued", "UTC", "2026-11-21T11:00:00.000Z"),
      ])?.id,
    ).toBe("queued");

    expect(
      selectDefaultReport([
        report("failed", "failed", "UTC", "2026-11-21T12:00:00.000Z"),
      ])?.id,
    ).toBe("failed");
  });

  it("uses the newest completed report timezone when the preferred timezone is absent", () => {
    const reports = [
      report("utc", "completed", "UTC", "2026-11-21T10:00:00.000Z"),
      report(
        "kolkata",
        "completed",
        "Asia/Kolkata",
        "2026-11-21T11:00:00.000Z",
      ),
    ];

    expect(selectTimezoneForReports(reports, "Europe/London")).toBe(
      "Asia/Kolkata",
    );
  });

  it("preserves a manually selected report when it still exists", () => {
    const older = report(
      "older",
      "completed",
      "UTC",
      "2026-11-21T10:00:00.000Z",
    );
    const newer = report(
      "newer",
      "completed",
      "UTC",
      "2026-11-21T11:00:00.000Z",
    );

    expect(selectReportForState([older, newer], "older")?.id).toBe("older");
    expect(selectReportForState([older, newer], "missing")?.id).toBe("newer");
  });

  it("returns the newest completed report from another date as fallback", () => {
    const reports = [
      report("failed", "failed", "UTC", "2026-11-25T12:00:00.000Z", "2026-11-25"),
      report("old", "completed", "UTC", "2026-11-20T10:00:00.000Z", "2026-11-20"),
      report("new", "completed", "UTC", "2026-11-21T10:00:00.000Z", "2026-11-21"),
      report("queued", "queued", "UTC", "2026-11-22T10:00:00.000Z", "2026-11-22"),
    ];

    expect(findCompletedReportFallback(reports, "2026-11-22")?.id).toBe("new");
  });

  it("does not use incomplete reports or the current date as fallback", () => {
    const reports = [
      report("failed", "failed", "UTC", "2026-11-25T12:00:00.000Z", "2026-11-25"),
      report("queued", "queued", "UTC", "2026-11-24T12:00:00.000Z", "2026-11-24"),
      report("generating", "generating", "UTC", "2026-11-23T12:00:00.000Z", "2026-11-23"),
      report("current", "completed", "UTC", "2026-11-22T10:00:00.000Z", "2026-11-22"),
    ];

    expect(findCompletedReportFallback(reports, "2026-11-22")).toBeNull();
  });
});
