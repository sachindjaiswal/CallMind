import { describe, expect, it } from "vitest";
import {
  dailyReportConflictDecisionSchema,
  dailyReportGenerateRequestSchema,
  dailyReportListQuerySchema,
} from "./dailyReports";

describe("daily report request schemas", () => {
  it("accepts a valid generation request", () => {
    const result = dailyReportGenerateRequestSchema.safeParse({
      reportDate: "2026-11-21",
      timezone: "Asia/Kolkata",
      recordingIds: ["a", "b"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate recording ids", () => {
    const result = dailyReportGenerateRequestSchema.safeParse({
      reportDate: "2026-11-21",
      timezone: "UTC",
      recordingIds: ["a", "a"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid dates and timezones", () => {
    expect(
      dailyReportGenerateRequestSchema.safeParse({
        reportDate: "2026-13-01",
        timezone: "UTC",
        recordingIds: ["a"],
      }).success,
    ).toBe(false);
    expect(
      dailyReportGenerateRequestSchema.safeParse({
        reportDate: "2026-11-21",
        timezone: "Mars/Olympus",
        recordingIds: ["a"],
      }).success,
    ).toBe(false);
  });

  it("coerces list query pagination", () => {
    const parsed = dailyReportListQuerySchema.parse({ page: "2", limit: "10" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
  });

  it("accepts only reviewable conflict statuses", () => {
    expect(
      dailyReportConflictDecisionSchema.safeParse({ status: "resolved" }).success,
    ).toBe(true);
    expect(
      dailyReportConflictDecisionSchema.safeParse({ status: "unresolved" }).success,
    ).toBe(false);
  });
});
