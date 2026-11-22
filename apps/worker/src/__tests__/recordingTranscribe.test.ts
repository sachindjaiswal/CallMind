import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { SttLanguageHint, TranscriptDto } from "@callmind/shared";
import { Recording } from "@callmind/db";
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
import { TranscriptionError } from "../lib/groqTranscription";
import {
  createRecordingTranscribeProcessor,
  type RecordingTranscribeJob,
} from "../queues/recordingTranscribe";

const TRANSCRIPT: TranscriptDto = {
  id: "tx-test",
  text: "hello world",
  language: "en",
  durationSeconds: 2,
  provider: "groq",
  model: "whisper-large-v3-turbo",
  processedAt: "2026-11-21T12:00:00.000Z",
  segments: [
    {
      id: "seg-test-0",
      index: 0,
      start: 0,
      end: 2,
      text: "hello world",
      speakerId: null,
    },
  ],
};

function makeJob(
  recordingId: string,
  options: { attemptsMade?: number; attempts?: number } = {},
): RecordingTranscribeJob {
  return {
    id: "job-1",
    data: { recordingId },
    attemptsMade: options.attemptsMade ?? 0,
    opts: { attempts: options.attempts ?? 3 },
  } as unknown as RecordingTranscribeJob;
}

describe("recording transcription processor", () => {
  let mongoServer: MongoMemoryServer;
  let storageRoot: string;
  let enqueueAnalysis: ReturnType<typeof vi.fn>;

  async function createReadyRecording(
    storageKey: string,
    checksum: string,
    languageHint: SttLanguageHint = "auto",
  ): Promise<string> {
    const absolutePath = resolve(storageRoot, storageKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from("fake audio bytes"));

    const recording = await Recording.create({
      workspaceId: "default",
      originalFilename: "call.wav",
      storageKey,
      extension: "wav",
      detectedMimeType: "audio/vnd.wave",
      sizeBytes: 17,
      checksum,
      status: "ready_for_transcription",
      languageHint,
      progress: 100,
      durationSeconds: 2,
      preparedAt: new Date(),
    });

    return String(recording._id);
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri("callmind"));
    storageRoot = await mkdtemp(join(tmpdir(), "callmind-transcribe-"));
    enqueueAnalysis = vi.fn(async (_recordingId: string) => undefined);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer?.stop();
    if (storageRoot) {
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    await Recording.deleteMany({});
    enqueueAnalysis.mockClear();
  });

  it("stores the transcript, queues analysis and advances the recording", async () => {
    const id = await createReadyRecording("audio/default/ok.wav", "ok-1");
    const transcriber = vi.fn(async () => TRANSCRIPT);
    const processor = createRecordingTranscribeProcessor({
      storageRoot,
      transcriber,
      enqueueAnalysis: (recordingId) => enqueueAnalysis(recordingId),
    });

    const result = await processor(makeJob(id));

    expect(result).toMatchObject({
      ok: true,
      recordingId: id,
      language: "en",
      durationSeconds: 2,
    });
    expect(transcriber).toHaveBeenCalledTimes(1);
    expect(transcriber).toHaveBeenCalledWith(
      join(storageRoot, "audio/default/ok.wav"),
      id,
      "auto",
    );

    expect(enqueueAnalysis).toHaveBeenCalledWith(id);

    const recording = await Recording.findById(id).lean();
    expect(recording?.status).toBe("analysis_queued");
    expect(recording?.progress).toBe(90);
    expect(recording?.transcriptionAttempts).toBe(1);
    expect(recording?.transcript).toMatchObject({
      text: "hello world",
      language: "en",
      provider: "groq",
    });
    expect(recording?.transcript?.segments[0].speakerId).toBeNull();
  });

  it("passes a Hindi language hint to the transcriber", async () => {
    const id = await createReadyRecording(
      "audio/default/hindi.wav",
      "ok-hi",
      "hi",
    );
    const transcriber = vi.fn(async () => TRANSCRIPT);
    const processor = createRecordingTranscribeProcessor({
      storageRoot,
      transcriber,
      enqueueAnalysis: (recordingId) => enqueueAnalysis(recordingId),
    });

    await processor(makeJob(id));

    expect(transcriber).toHaveBeenCalledWith(
      join(storageRoot, "audio/default/hindi.wav"),
      id,
      "hi",
    );
  });

  it("is idempotent when a job is delivered twice", async () => {
    const id = await createReadyRecording("audio/default/twice.wav", "ok-2");
    const transcriber = vi.fn(async () => TRANSCRIPT);
    const processor = createRecordingTranscribeProcessor({
      storageRoot,
      transcriber,
      enqueueAnalysis: (recordingId) => enqueueAnalysis(recordingId),
    });

    const first = await processor(makeJob(id));
    const second = await processor(makeJob(id));

    expect(first.skipped).toBeUndefined();
    expect(second.skipped).toBe(true);
    expect(transcriber).toHaveBeenCalledTimes(1);
  });

  it("requeues retryable failures and fails on the final attempt", async () => {
    const id = await createReadyRecording("audio/default/retry.wav", "ok-3");
    const transcriber = vi.fn(async () => {
      throw new TranscriptionError(
        "Provider temporarily unavailable.",
        "TRANSCRIPTION_RATE_LIMITED",
        true,
      );
    });
    const processor = createRecordingTranscribeProcessor({
      storageRoot,
      transcriber,
      enqueueAnalysis: (recordingId) => enqueueAnalysis(recordingId),
    });

    await expect(processor(makeJob(id))).rejects.toThrow(
      /temporarily unavailable/i,
    );
    let recording = await Recording.findById(id).lean();
    expect(recording?.status).toBe("transcription_queued");
    expect(recording?.error?.code).toBe("TRANSCRIPTION_RATE_LIMITED");

    await expect(
      processor(makeJob(id, { attemptsMade: 2 })),
    ).rejects.toThrow(/temporarily unavailable/i);
    recording = await Recording.findById(id).lean();
    expect(recording?.status).toBe("failed");
    expect(recording?.transcriptionAttempts).toBe(2);
  });

  it("fails immediately for non-retryable configuration errors", async () => {
    const id = await createReadyRecording("audio/default/config.wav", "ok-4");
    const transcriber = vi.fn(async () => {
      throw new TranscriptionError(
        "Groq API key is not configured.",
        "TRANSCRIPTION_NOT_CONFIGURED",
        false,
      );
    });
    const processor = createRecordingTranscribeProcessor({
      storageRoot,
      transcriber,
      enqueueAnalysis: (recordingId) => enqueueAnalysis(recordingId),
    });

    await expect(processor(makeJob(id))).rejects.toThrowError(
      UnrecoverableError,
    );

    const recording = await Recording.findById(id).lean();
    expect(recording?.status).toBe("failed");
    expect(recording?.error?.code).toBe("TRANSCRIPTION_NOT_CONFIGURED");
  });

  it("keeps the transcript when analysis queueing fails", async () => {
    const id = await createReadyRecording("audio/default/noqueue.wav", "ok-5");
    const transcriber = vi.fn(async () => TRANSCRIPT);
    const failingEnqueue = vi.fn(async () => {
      throw new Error("Redis unavailable");
    });
    const processor = createRecordingTranscribeProcessor({
      storageRoot,
      transcriber,
      enqueueAnalysis: failingEnqueue,
    });

    const result = await processor(makeJob(id));

    expect(result.ok).toBe(true);
    const recording = await Recording.findById(id).lean();
    expect(recording?.status).toBe("analysis_failed");
    expect(recording?.error?.code).toBe("ANALYSIS_QUEUE_UNAVAILABLE");
    expect(recording?.transcript?.text).toBe("hello world");
  });
});
