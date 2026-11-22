import { describe, expect, it } from "vitest";
import {
  DailyReportSourceValidationError,
  validateReportSources,
} from "./reportSources";

const base = {
  workspaceId: "default",
  reportDate: "2026-11-21",
  timezone: "UTC",
  recordingIds: ["recording-1"],
  recordings: [
    {
      id: "recording-1",
      workspaceId: "default",
      status: "analysis_completed",
      transcriptId: "tx-1",
      createdAt: "2026-11-21T12:00:00.000Z",
    },
  ],
  analyses: [
    {
      id: "analysis-1",
      workspaceId: "default",
      recordingId: "recording-1",
      status: "completed",
      analyzedAt: "2026-11-21T12:05:00.000Z",
    },
  ],
};

function expectErrorCode(input: typeof base, code: string): void {
  try {
    validateReportSources(input);
    throw new Error("Expected validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(DailyReportSourceValidationError);
    expect((error as DailyReportSourceValidationError).code).toBe(code);
  }
}

describe("daily report source validation", () => {
  it("accepts completed analyses in the selected date and workspace", () => {
    const result = validateReportSources(base);
    expect(result).toEqual([
      {
        recordingId: "recording-1",
        transcriptId: "tx-1",
        analysisId: "analysis-1",
        createdAt: "2026-11-21T12:00:00.000Z",
        analyzedAt: "2026-11-21T12:05:00.000Z",
      },
    ]);
  });

  it("rejects cross-workspace recordings", () => {
    expectErrorCode(
      {
        ...base,
        recordings: [{ ...base.recordings[0], workspaceId: "other" }],
      },
      "CROSS_WORKSPACE_RECORDING",
    );
  });

  it("rejects recordings outside the explicit reporting timezone", () => {
    expectErrorCode(
      {
        ...base,
        timezone: "Asia/Kolkata",
        recordings: [
          {
            ...base.recordings[0],
            createdAt: "2026-11-21T20:00:00.000Z",
          },
        ],
      },
      "RECORDING_OUTSIDE_REPORT_DATE",
    );
  });

  it("rejects incomplete and failed sources", () => {
    expectErrorCode(
      {
        ...base,
        recordings: [{ ...base.recordings[0], status: "analysis_failed" }],
      },
      "RECORDING_NOT_READY",
    );
    expectErrorCode(
      {
        ...base,
        analyses: [{ ...base.analyses[0], status: "failed" }],
      },
      "ANALYSIS_NOT_COMPLETED",
    );
  });

  it("rejects missing analyses", () => {
    expectErrorCode({ ...base, analyses: [] }, "ANALYSIS_NOT_FOUND");
  });
});
