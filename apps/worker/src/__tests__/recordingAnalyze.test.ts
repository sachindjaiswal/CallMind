import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranscriptDto } from "@callmind/shared";
import { ConversationAnalysis as AnalysisModel, Recording } from "@callmind/db";
import { UnrecoverableError } from "bullmq";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { ConversationAnalysisResult } from "../lib/conversationAnalysis";
import { GeminiAnalysisError } from "../lib/geminiAnalysis";
import {
  createRecordingAnalyzeProcessor,
  type RecordingAnalyzeJob,
} from "../queues/recordingAnalyze";

function makeJob(
  recordingId: string,
  options: { attemptsMade?: number; attempts?: number } = {},
): RecordingAnalyzeJob {
  return {
    id: "job-1",
    data: { recordingId },
    attemptsMade: options.attemptsMade ?? 0,
    opts: { attempts: options.attempts ?? 2 },
  } as unknown as RecordingAnalyzeJob;
}

function transcriptFor(id: string): TranscriptDto {
  return {
    id: `tx-${id}`,
    text: "Let us review the roadmap on Friday.",
    language: "en",
    durationSeconds: 4,
    provider: "groq",
    model: "whisper-large-v3-turbo",
    processedAt: "2026-11-21T12:00:00.000Z",
    segments: [
      {
        id: `seg-${id}-0`,
        index: 0,
        start: 0,
        end: 4,
        text: "Let us review the roadmap on Friday.",
        speakerId: null,
      },
    ],
  };
}

function analysisResult(): ConversationAnalysisResult {
  return {
    provider: "gemini",
    model: "model-primary",
    fallbackUsed: false,
    attemptedModels: ["model-primary"],
    schemaVersion: "conversation-insights-v1",
    promptVersion: "conversation-analysis-v1",
    summary: "The team planned a roadmap review.",
    topics: ["roadmap"],
    insights: [
      {
        category: "task",
        explicitness: "explicit",
        summary: "Review the roadmap on Friday.",
        speakerId: null,
        evidence: {
          recordingId: "",
          segmentId: "",
          segmentIndex: 0,
          start: 0,
          end: 4,
          quote: "review the roadmap on Friday",
        },
      },
    ],
  } as unknown as ConversationAnalysisResult;
}

describe("recording analysis processor", () => {
  let mongoServer: MongoMemoryServer;
  let storageRoot: string;

  async function createRecording(
    checksum: string,
    status: "analysis_queued" | "analysis_failed" = "analysis_queued",
  ): Promise<string> {
    const recording = await Recording.create({
      workspaceId: "default",
      originalFilename: "analysis.wav",
      storageKey: "audio/default/analysis.wav",
      extension: "wav",
      detectedMimeType: "audio/vnd.wave",
      sizeBytes: 100,
      checksum,
      status,
      preparedAt: new Date(),
      progress: 90,
      transcript: transcriptFor(checksum),
    });
    return String(recording._id);
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    storageRoot = await mkdtemp(join(tmpdir(), "callmind-analyze-"));
    await mongoose.connect(mongoServer.getUri("callmind"));
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
    await rm(storageRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await Recording.deleteMany({});
    await AnalysisModel.deleteMany({});
  });

  it("persists analysis, completes the recording and skips an unchanged transcript", async () => {
    const id = await createRecording("analysis-ok");
    const analyze = vi.fn(async () => analysisResult());
    const processor = createRecordingAnalyzeProcessor({ analyze });

    const first = await processor(makeJob(id));
    const recordingAfterFirst = await Recording.findById(id).lean();
    const analysisAfterFirst = await AnalysisModel.findOne({ recordingId: id }).lean();
    const transcriptAfterFirst = recordingAfterFirst?.transcript;

    const second = await processor(makeJob(id));

    expect(first).toMatchObject({
      ok: true,
      recordingId: id,
      model: "model-primary",
    });
    expect(second.skipped).toBe(true);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(recordingAfterFirst?.status).toBe("analysis_completed");
    expect(recordingAfterFirst?.transcript).toEqual(transcriptAfterFirst);
    expect(analysisAfterFirst).toMatchObject({
      status: "completed",
      transcriptId: `tx-analysis-ok`,
      model: "model-primary",
      summary: "The team planned a roadmap review.",
      attempts: 1,
    });
  });

  it("reanalyses when the transcript identifier changes", async () => {
    const id = await createRecording("analysis-changed");
    const analyze = vi.fn(async () => analysisResult());
    const processor = createRecordingAnalyzeProcessor({ analyze });

    await processor(makeJob(id));
    await AnalysisModel.updateOne(
      { recordingId: id },
      { $set: { transcriptId: "tx-old" } },
    );
    await Recording.updateOne(
      { _id: id },
      { $set: { status: "analysis_queued" } },
    );

    const result = await processor(makeJob(id));

    expect(result.skipped).toBeUndefined();
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("requeues temporary provider failures and fails on the final attempt", async () => {
    const id = await createRecording("analysis-retry", "analysis_failed");
    const analyze = vi.fn(async () => {
      throw new GeminiAnalysisError({
        message: "Gemini temporarily unavailable",
        code: "GEMINI_TEMPORARY_UNAVAILABLE",
        retryable: true,
        model: "model-primary",
      });
    });
    const processor = createRecordingAnalyzeProcessor({ analyze });

    await expect(processor(makeJob(id))).rejects.toThrow(/temporarily unavailable/i);
    let recording = await Recording.findById(id).lean();
    let analysis = await AnalysisModel.findOne({ recordingId: id }).lean();
    expect(recording?.status).toBe("analysis_queued");
    expect(analysis?.status).toBe("queued");
    expect(analysis?.attempts).toBe(1);

    await Recording.updateOne({ _id: id }, { $set: { status: "analysis_queued" } });
    await expect(
      processor(makeJob(id, { attemptsMade: 1 })),
    ).rejects.toThrow(/temporarily unavailable/i);
    recording = await Recording.findById(id).lean();
    analysis = await AnalysisModel.findOne({ recordingId: id }).lean();
    expect(recording?.status).toBe("analysis_failed");
    expect(analysis?.status).toBe("failed");
    expect(analysis?.error?.code).toBe("GEMINI_TEMPORARY_UNAVAILABLE");
  });

  it("fails immediately for invalid request errors", async () => {
    const id = await createRecording("analysis-invalid", "analysis_failed");
    const analyze = vi.fn(async () => {
      throw new GeminiAnalysisError({
        message: "Invalid request",
        code: "GEMINI_INVALID_REQUEST",
        retryable: false,
        model: "model-primary",
      });
    });
    const processor = createRecordingAnalyzeProcessor({ analyze });

    await expect(processor(makeJob(id))).rejects.toThrowError(UnrecoverableError);

    const recording = await Recording.findById(id).lean();
    expect(recording?.status).toBe("analysis_failed");
    expect(recording?.error?.code).toBe("GEMINI_INVALID_REQUEST");
  });
});
