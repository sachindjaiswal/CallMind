import type { HealthResponse } from "@callmind/shared";
import {
  ConversationAnalysis,
  DailyReport,
  Recording,
} from "@callmind/db";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import pino from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { createDailyReportsRouter } from "../routes/dailyReports";
import { createDailyReportService } from "../services/dailyReportService";

const logger = pino({ level: "silent" });
const healthPayload: HealthResponse = {
  status: "ok",
  service: "callmind-api",
  version: "0.1.0",
  timestamp: new Date().toISOString(),
  uptimeSeconds: 1,
  services: {
    api: { status: "up" },
    mongodb: { status: "up" },
    redis: { status: "up" },
  },
};

function transcriptFor(recordingId: string) {
  return {
    id: `tx-${recordingId}`,
    text: "A complete source quote.",
    language: "en",
    durationSeconds: 5,
    provider: "groq" as const,
    model: "whisper-large-v3-turbo",
    processedAt: "2026-11-21T12:00:00.000Z",
    segments: [
      {
        id: `seg-${recordingId}-0`,
        index: 0,
        start: 0,
        end: 5,
        text: "A complete source quote.",
        speakerId: null,
      },
    ],
  };
}

const insight = {
  category: "insight",
  explicitness: "explicit",
  confidence: "high",
  summary: "A complete source quote.",
  speakerId: null,
  evidence: {
    recordingId: "",
    segmentId: "",
    segmentIndex: 0,
    start: 0,
    end: 5,
    quote: "A complete source quote.",
  },
  name: null,
  role: null,
  contactInfo: null,
  description: null,
  assignedBy: null,
  assignedTo: null,
  taskDirection: null,
  deadlineOriginal: null,
  dueDate: null,
  status: null,
  originalExpression: null,
  normalizedDate: null,
  dateType: null,
  referenceDate: null,
  participants: [],
  madeBy: null,
  concerns: null,
  productOrService: null,
  quantity: null,
  amount: null,
  currency: null,
  paymentStatus: null,
  deliveryStatus: null,
  milestone: null,
  severity: null,
  question: null,
  askedBy: null,
  relatedPeople: [],
  relatedProjects: [],
};

async function createSource(
  checksum: string,
  analysisStatus: "completed" | "failed" = "completed",
): Promise<string> {
  const recording = await Recording.create({
    workspaceId: "default",
    originalFilename: `${checksum}.wav`,
    storageKey: `audio/default/${checksum}.wav`,
    extension: "wav",
    detectedMimeType: "audio/vnd.wave",
    sizeBytes: 100,
    checksum,
    status: "analysis_completed",
    transcript: transcriptFor(checksum),
  });
  const recordingId = String(recording._id);
  await ConversationAnalysis.create({
    workspaceId: "default",
    recordingId,
    transcriptId: `tx-${recordingId}`,
    status: analysisStatus,
    provider: "gemini",
    model: "gemini-3.1-flash-lite",
    fallbackUsed: false,
    attemptedModels: [],
    schemaVersion: "conversation-insights-v1",
    promptVersion: "conversation-analysis-v1",
    summary: "A single source was analysed.",
    topics: [],
    insights: [{ ...insight, evidence: { ...insight.evidence, recordingId } }],
    analyzedAt: analysisStatus === "completed" ? new Date() : null,
    attempts: 1,
  });
  return recordingId;
}

describe("daily reports API", () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof createApp>;
  let enqueue: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri("callmind"));
    enqueue = vi.fn(async (_reportId: string) => undefined);
    const service = createDailyReportService({
      workspaceId: "default",
      enqueueReport: (reportId) => enqueue(reportId),
    });
    app = createApp({
      logger,
      corsOrigins: [],
      getHealth: async () => healthPayload,
      dailyReportsRouter: createDailyReportsRouter({ service }),
    });
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  beforeEach(async () => {
    enqueue.mockClear();
    await Promise.all([
      DailyReport.deleteMany({}),
      ConversationAnalysis.deleteMany({}),
      Recording.deleteMany({}),
    ]);
  });

  it("queues a report for explicit sources and prevents duplicate requests", async () => {
    const recordingId = await createSource("api-complete");
    const payload = {
      reportDate: "2026-11-21",
      timezone: "UTC",
      recordingIds: [recordingId],
    };

    const first = await request(app).post("/api/daily-reports").send(payload);
    expect(first.status).toBe(202);
    expect(first.body.status).toBe("queued");
    expect(first.body.selectedRecordingIds).toEqual([recordingId]);
    expect(enqueue).toHaveBeenCalledWith(first.body.id);

    const duplicate = await request(app).post("/api/daily-reports").send(payload);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("REPORT_DUPLICATE_REQUEST");
  });

  it("rejects incomplete sources", async () => {
    const recordingId = await createSource("api-failed", "failed");
    const response = await request(app).post("/api/daily-reports").send({
      reportDate: "2026-11-21",
      timezone: "UTC",
      recordingIds: [recordingId],
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("ANALYSIS_NOT_COMPLETED");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("lists reports and regenerates a new version", async () => {
    const recordingId = await createSource("api-regenerate");
    const created = await request(app).post("/api/daily-reports").send({
      reportDate: "2026-11-21",
      timezone: "UTC",
      recordingIds: [recordingId],
    });

    const listed = await request(app).get("/api/daily-reports?limit=10");
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(1);

    const regenerated = await request(app).post(
      `/api/daily-reports/${created.body.id}/regenerate`,
    );
    expect(regenerated.status).toBe(202);
    expect(regenerated.body.id).not.toBe(created.body.id);
    expect(regenerated.body.previousReportId).toBe(created.body.id);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it("reviews conflicts without changing source analyses", async () => {
    const report = await DailyReport.create({
      workspaceId: "default",
      reportDate: "2026-11-21",
      timezone: "UTC",
      status: "completed",
      selectedRecordingIds: [],
      sourceRecordings: [],
      sourceAnalysisIds: [],
      overallSummary: "Report with a conflict.",
      consolidatedInsights: [],
      relationships: [],
      conflicts: [
        {
          id: "conflict-1",
          type: "quantity_conflict",
          summary: "Quantity differs.",
          explanation: "Two recordings disagree.",
          explicitness: "explicit",
          confidence: "high",
          sourceInsightIds: [],
          sourceRecordingIds: [],
          values: [
            {
              value: "10",
              insightId: "insight-a",
              recordingId: "recording-a",
              evidence: {
                insightId: "insight-a",
                analysisId: "analysis-a",
                recordingId: "recording-a",
                segmentId: "seg-a-0",
                segmentIndex: 0,
                start: 0,
                end: 1,
                quote: "ten",
              },
            },
            {
              value: "20",
              insightId: "insight-b",
              recordingId: "recording-b",
              evidence: {
                insightId: "insight-b",
                analysisId: "analysis-b",
                recordingId: "recording-b",
                segmentId: "seg-b-0",
                segmentIndex: 0,
                start: 0,
                end: 1,
                quote: "twenty",
              },
            },
          ],
          status: "unresolved",
          reviewerNote: null,
          reviewedAt: null,
        },
      ],
      provider: "system",
      model: "deterministic-v1",
      schemaVersion: "daily-report-v1",
      generationVersion: "deterministic-v1",
      requestFingerprint: "conflict-test",
      previousReportId: null,
      attempts: 1,
      error: null,
      generatedAt: new Date(),
    });
    const reportId = String(report._id);

    const response = await request(app)
      .patch(`/api/daily-reports/${reportId}/conflicts/conflict-1`)
      .send({ status: "resolved", reviewerNote: "Checked with both callers." });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("resolved");
    expect(response.body.reviewerNote).toBe("Checked with both callers.");

    const detail = await request(app).get(`/api/daily-reports/${reportId}`);
    expect(detail.body.conflicts[0].status).toBe("resolved");
  });
});
