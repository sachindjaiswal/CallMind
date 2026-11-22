import type { AnalysisDto } from "@callmind/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysisPanel, groupInsightsByCategory } from "./analysis-panel";

const analysis = {
  id: "analysis-1",
  recordingId: "recording-1",
  transcriptId: "tx-recording-1",
  status: "completed",
  provider: "gemini",
  model: "model-primary",
  fallbackUsed: false,
  attemptedModels: ["model-primary"],
  schemaVersion: "conversation-insights-v1",
  promptVersion: "conversation-analysis-v1",
  summary: "The call covered planning and a follow-up task.",
  topics: ["planning", "roadmap"],
  insights: [
    {
      category: "task",
      explicitness: "explicit",
      summary: "Review the roadmap on Friday.",
      speakerId: null,
      evidence: {
        recordingId: "recording-1",
        segmentId: "seg-recording-1-0",
        segmentIndex: 0,
        start: 0,
        end: 4,
        quote: "review the roadmap on Friday",
      },
    },
    {
      category: "person",
      explicitness: "inferred",
      confidence: "low",
      summary: "Maya may be relevant to the API discussion.",
      speakerId: null,
      evidence: {
        recordingId: "recording-1",
        segmentId: "seg-recording-1-1",
        segmentIndex: 1,
        start: 4,
        end: 8,
        quote: "ask Maya about the API",
      },
      name: "Maya",
    },
    {
      category: "date",
      explicitness: "explicit",
      summary: "Friday was mentioned.",
      speakerId: null,
      evidence: {
        recordingId: "recording-1",
        segmentId: "seg-recording-1-0",
        segmentIndex: 0,
        start: 0,
        end: 4,
        quote: "Friday",
      },
      originalExpression: "Friday",
    },
  ],
  error: null,
  analyzedAt: "2026-11-21T12:00:00.000Z",
  attempts: 1,
  createdAt: "2026-11-21T12:00:00.000Z",
  updatedAt: "2026-11-21T12:00:00.000Z",
} as unknown as AnalysisDto;

describe("analysis panel", () => {
  it("groups only categories that contain insights", () => {
    const groups = groupInsightsByCategory(analysis.insights);

    expect(groups.map((group) => group.category)).toEqual([
      "person",
      "task",
      "date",
    ]);
    expect(groups.every((group) => group.insights.length > 0)).toBe(true);
  });

  it("renders multiple insight categories with explicitness and evidence", () => {
    const markup = renderToStaticMarkup(
      <AnalysisPanel
        analysis={analysis}
        status="analysis_completed"
        onLocateEvidence={() => undefined}
      />,
    );

    expect(markup).toContain("Conversation intelligence");
    expect(markup).toContain("Tasks");
    expect(markup).toContain("People");
    expect(markup).toContain("Dates");
    expect(markup).toContain("explicit");
    expect(markup).toContain("inferred");
    expect(markup).toContain("Evidence");
  });

  it("renders loading and failed states", () => {
    const loading = renderToStaticMarkup(
      <AnalysisPanel analysis={null} status="analysis_queued" />,
    );
    const failed = renderToStaticMarkup(
      <AnalysisPanel
        analysis={null}
        status="analysis_failed"
        error="Gemini unavailable"
        onRetry={() => undefined}
      />,
    );

    expect(loading).toContain("AI analysis in progress");
    expect(failed).toContain("Gemini unavailable");
    expect(failed).toContain("Retry analysis");
  });
});
