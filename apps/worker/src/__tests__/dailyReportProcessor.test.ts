import {
  ConversationAnalysis,
  DailyReport,
  Recording,
} from "@callmind/db";
import {
  insightSchema,
  type ConversationInsight,
} from "@callmind/shared";
import { UnrecoverableError } from "bullmq";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDailyReportProcessor,
  type DailyReportJob,
} from "../queues/dailyReport";

function makeJob(reportId: string): DailyReportJob {
  return {
    id: `job-${reportId}`,
    data: { reportId },
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as unknown as DailyReportJob;
}

function transcriptFor(recordingId: string, quote: string) {
  return {
    id: `tx-${recordingId}`,
    text: quote,
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
        text: quote,
        speakerId: null,
      },
    ],
  };
}

function insightFor(recordingId: string, quote: string): ConversationInsight {
  return insightSchema.parse({
    category: "insight",
    explicitness: "explicit",
    confidence: "high",
    summary: quote,
    speakerId: null,
    evidence: {
      recordingId,
      segmentId: `seg-${recordingId}-0`,
      segmentIndex: 0,
      start: 0,
      end: 5,
      quote,
    },
  });
}

async function createSource(options: {
  checksum: string;
  analysisStatus: "completed" | "failed";
}): Promise<string> {
  const recording = await Recording.create({
    workspaceId: "default",
    originalFilename: "daily.wav",
    storageKey: `audio/default/${options.checksum}.wav`,
    extension: "wav",
    detectedMimeType: "audio/vnd.wave",
    sizeBytes: 100,
    checksum: options.checksum,
    status: "analysis_completed",
    transcript: transcriptFor(options.checksum, "A complete source quote."),
  });
  const recordingId = String(recording._id);

  await ConversationAnalysis.create({
    workspaceId: "default",
    recordingId,
    transcriptId: `tx-${recordingId}`,
    status: options.analysisStatus,
    provider: "gemini",
    model: "gemini-3.1-flash-lite",
    fallbackUsed: false,
    attemptedModels: [],
    schemaVersion: "conversation-insights-v1",
    promptVersion: "conversation-analysis-v1",
    summary: "A single source was analysed.",
    topics: [],
    insights: [insightFor(recordingId, "A complete source quote.")],
    analyzedAt: options.analysisStatus === "completed" ? new Date() : null,
    attempts: 1,
  });

  return recordingId;
}

async function createReport(
  recordingIds: string[],
  fingerprint: string,
): Promise<string> {
  const report = await DailyReport.create({
    workspaceId: "default",
    reportDate: "2026-11-21",
    timezone: "UTC",
    status: "queued",
    selectedRecordingIds: recordingIds,
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
    requestFingerprint: fingerprint,
    previousReportId: null,
    attempts: 0,
    error: null,
    generatedAt: null,
  });
  return String(report._id);
}

describe("daily report processor", () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri("callmind"));
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      DailyReport.deleteMany({}),
      ConversationAnalysis.deleteMany({}),
      Recording.deleteMany({}),
    ]);
  });

  it("generates a report once and skips duplicate jobs", async () => {
    const recordingId = await createSource({
      checksum: "processor-complete",
      analysisStatus: "completed",
    });
    const reportId = await createReport([recordingId], "fingerprint-complete");
    const processor = createDailyReportProcessor();

    const result = await processor(makeJob(reportId));
    expect(result).toMatchObject({
      ok: true,
      reportId,
      insightCount: 1,
      conflictCount: 0,
    });

    const completed = await DailyReport.findById(reportId).lean();
    expect(completed?.status).toBe("completed");
    expect(completed?.attempts).toBe(1);
    expect(completed?.generatedAt).not.toBeNull();

    const duplicate = await processor(makeJob(reportId));
    expect(duplicate.skipped).toBe(true);
    const afterDuplicate = await DailyReport.findById(reportId).lean();
    expect(afterDuplicate?.attempts).toBe(1);
  });

  it("fails permanently for an incomplete source", async () => {
    const recordingId = await createSource({
      checksum: "processor-failed",
      analysisStatus: "failed",
    });
    const reportId = await createReport([recordingId], "fingerprint-failed");

    await expect(
      createDailyReportProcessor()(makeJob(reportId)),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    const failed = await DailyReport.findById(reportId).lean();
    expect(failed?.status).toBe("failed");
    expect(failed?.error?.code).toBe("ANALYSIS_NOT_COMPLETED");
  });
});
