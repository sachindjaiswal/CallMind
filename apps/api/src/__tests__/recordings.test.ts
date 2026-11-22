import { access } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { HealthResponse } from "@callmind/shared";
import { ConversationAnalysis, Recording } from "@callmind/db";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import pino from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { initStorage, type StorageLayout } from "../lib/storage";
import { createRecordingsRouter } from "../routes/recordings";
import { createRecordingService } from "../services/recordingService";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const logger = pino({ level: "silent" });

function createWavBufferOfSize(totalBytes: number): Buffer {
  const buffer = Buffer.alloc(totalBytes);
  const dataSize = totalBytes - 44;
  const sampleRate = 8_000;
  const channels = 1;
  const bitsPerSample = 16;

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(
    sampleRate * channels * (bitsPerSample / 8),
    28,
  );
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function createWavBuffer(durationSeconds = 1): Buffer {
  const sampleRate = 8_000;
  const channels = 1;
  const bitsPerSample = 16;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  return createWavBufferOfSize(44 + sampleCount * channels * (bitsPerSample / 8));
}

function create3GppSignatureBuffer(): Buffer {
  const ftyp = Buffer.from([
    0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x33, 0x67, 0x70, 0x34, 0, 0,
    0, 0, 0x69, 0x73, 0x6f, 0x6d, 0x33, 0x67, 0x70, 0x34,
  ]);
  return Buffer.concat([ftyp, Buffer.alloc(8192, 0)]);
}

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

describe("recordings API", () => {
  let mongoServer: MongoMemoryServer;
  let storageRoot: string;
  let storage: StorageLayout;
  let enqueue: ReturnType<typeof vi.fn>;
  let enqueueTranscription: ReturnType<typeof vi.fn>;
  let enqueueAnalysis: ReturnType<typeof vi.fn>;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri("callmind"));
    storageRoot = await mkdtemp(join(tmpdir(), "callmind-api-"));
    storage = await initStorage(storageRoot);

    enqueue = vi.fn(async (_recordingId: string) => undefined);
    enqueueTranscription = vi.fn(async (_recordingId: string) => undefined);
    enqueueAnalysis = vi.fn(async (_recordingId: string) => undefined);
    const service = createRecordingService({
      storageRoot: storage.root,
      workspaceId: "default",
      maxFileSizeBytes: MAX_FILE_BYTES,
      maxFilesPerUpload: 3,
      enqueuePreparation: (recordingId) => enqueue(recordingId),
      enqueueTranscription: (recordingId) => enqueueTranscription(recordingId),
      enqueueAnalysis: (recordingId) => enqueueAnalysis(recordingId),
    });

    app = createApp({
      logger,
      corsOrigins: [],
      getHealth: async () => healthPayload,
      recordingsRouter: createRecordingsRouter({
        service,
        tempDir: storage.tempDir,
        maxFileSizeBytes: MAX_FILE_BYTES,
        maxFilesPerUpload: 3,
        logger,
      }),
    });
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
    await ConversationAnalysis.deleteMany({});
    enqueue.mockClear();
    enqueueTranscription.mockClear();
    enqueueAnalysis.mockClear();
  });

  it("exposes upload configuration", async () => {
    const response = await request(app).get("/api/recordings/config");

    expect(response.status).toBe(200);
    expect(response.body.maxFileSizeBytes).toBe(MAX_FILE_BYTES);
    expect(response.body.maxFilesPerUpload).toBe(3);
    expect(response.body.supportedExtensions).toContain("wav");
    expect(response.body.supportedLanguageHints).toEqual([
      "auto",
      "en",
      "hi",
    ]);
  });

  it("uploads a valid wav file, stores it safely and queues preparation", async () => {
    const wav = createWavBuffer();

    const response = await request(app)
      .post("/api/recordings/upload")
      .attach("files", wav, { filename: "call.wav", contentType: "audio/wav" });

    expect(response.status).toBe(201);
    expect(response.body.summary).toEqual({
      created: 1,
      duplicate: 0,
      rejected: 0,
    });

    const result = response.body.results[0];
    expect(result.status).toBe("created");
    expect(result.recording.status).toBe("queued");
    expect(result.recording.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(enqueue).toHaveBeenCalledWith(result.recording.id);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("storageKey");

    const stored = await Recording.findById(result.recording.id).lean();
    expect(stored).not.toBeNull();
    expect(stored?.storageKey).toMatch(/^audio\/default\/\d{4}\/\d{2}\/[a-f0-9-]+\.wav$/);
    await expect(access(resolve(storageRoot, stored!.storageKey))).resolves.toBeUndefined();
  });

  it("stores the selected transcription language hint", async () => {
    const response = await request(app)
      .post("/api/recordings/upload")
      .field("languageHint", "hi")
      .attach("files", createWavBuffer(), {
        filename: "hindi.wav",
        contentType: "audio/wav",
      });

    expect(response.status).toBe(201);
    expect(response.body.results[0].recording.languageHint).toBe("hi");

    const stored = await Recording.findById(
      response.body.results[0].recording.id,
    ).lean();
    expect(stored?.languageHint).toBe("hi");
  });

  it("rejects an invalid transcription language hint", async () => {
    const response = await request(app)
      .post("/api/recordings/upload")
      .field("languageHint", "de")
      .attach("files", createWavBuffer(), {
        filename: "invalid-hint.wav",
        contentType: "audio/wav",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_LANGUAGE_HINT");
    expect(await Recording.countDocuments({})).toBe(0);
  });

  it("accepts a wav file exactly at the 25 MiB limit", async () => {
    const response = await request(app)
      .post("/api/recordings/upload")
      .attach("files", createWavBufferOfSize(MAX_FILE_BYTES), {
        filename: "exact-limit.wav",
        contentType: "audio/wav",
      });

    expect(response.status).toBe(201);
    expect(response.body.summary.rejected).toBe(0);
    expect(response.body.results[0].status).toBe("created");
    expect(response.body.results[0].recording.sizeBytes).toBe(MAX_FILE_BYTES);
  }, 30_000);

  it("detects duplicate content across requests without requeueing", async () => {
    const wav = createWavBuffer();

    const first = await request(app)
      .post("/api/recordings/upload")
      .attach("files", wav, { filename: "first.wav", contentType: "audio/wav" });

    const second = await request(app)
      .post("/api/recordings/upload")
      .attach("files", wav, {
        filename: "renamed-copy.wav",
        contentType: "audio/wav",
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.results[0].status).toBe("duplicate");
    expect(second.body.results[0].duplicateOf).toBe(
      first.body.results[0].recording.id,
    );
    expect(await Recording.countDocuments({})).toBe(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("rejects an unsupported extension per file", async () => {
    const response = await request(app)
      .post("/api/recordings/upload")
      .attach("files", createWavBuffer(), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(200);
    expect(response.body.summary.rejected).toBe(1);
    expect(response.body.results[0].error.code).toBe("UNSUPPORTED_FORMAT");
    expect(await Recording.countDocuments({})).toBe(0);
  });

  it("rejects a file whose contents do not match its extension", async () => {
    const response = await request(app)
      .post("/api/recordings/upload")
      .attach("files", Buffer.from("this is definitely not audio"), {
        filename: "fake.wav",
        contentType: "audio/wav",
      });

    expect(response.status).toBe(200);
    expect(response.body.results[0].error.code).toBe("INVALID_SIGNATURE");
    expect(await Recording.countDocuments({})).toBe(0);
  });

  it("accepts a 3GPP-family MP4 file named with an .mp4 extension", async () => {
    const response = await request(app)
      .post("/api/recordings/upload")
      .attach("files", create3GppSignatureBuffer(), {
        filename: "phone-recording.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(201);
    expect(response.body.results[0].status).toBe("created");
    expect(response.body.results[0].recording.mimeType).toBe("video/3gpp");
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(await Recording.countDocuments({})).toBe(1);
  });

  it("rejects a file larger than the configured limit", async () => {
    const oversized = Buffer.alloc(MAX_FILE_BYTES + 1, 7);

    const response = await request(app)
      .post("/api/recordings/upload")
      .attach("files", oversized, {
        filename: "huge.wav",
        contentType: "audio/wav",
      });

    expect(response.status).toBe(200);
    expect(response.body.results[0].error.code).toBe("FILE_TOO_LARGE");
    expect(response.body.results[0].error.message).toContain("25 MiB limit");
  }, 30_000);

  it("processes mixed batches without losing valid files", async () => {
    const response = await request(app)
      .post("/api/recordings/upload")
      .attach("files", createWavBuffer(), {
        filename: "good.wav",
        contentType: "audio/wav",
      })
      .attach("files", Buffer.from("nope"), {
        filename: "bad.wav",
        contentType: "audio/wav",
      });

    expect(response.status).toBe(201);
    expect(response.body.summary).toEqual({
      created: 1,
      duplicate: 0,
      rejected: 1,
    });
  });

  it("lists and filters recordings", async () => {
    await request(app)
      .post("/api/recordings/upload")
      .attach("files", createWavBuffer(), {
        filename: "listed.wav",
        contentType: "audio/wav",
      });

    const response = await request(app).get(
      "/api/recordings?status=queued&page=1&limit=10",
    );

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].originalFilename).toBe("listed.wav");
    expect(response.body.totalPages).toBe(1);
  });

  it("returns a recording by id and validates bad ids", async () => {
    const upload = await request(app)
      .post("/api/recordings/upload")
      .attach("files", createWavBuffer(), {
        filename: "detail.wav",
        contentType: "audio/wav",
      });
    const id = upload.body.results[0].recording.id as string;

    const found = await request(app).get(`/api/recordings/${id}`);
    expect(found.status).toBe(200);
    expect(found.body.id).toBe(id);

    const invalid = await request(app).get("/api/recordings/not-an-id");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_RECORDING_ID");

    const missing = await request(app).get(
      "/api/recordings/64b7f9c2e1b2a4d5f6a7b8c9",
    );
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RECORDING_NOT_FOUND");
  });

  it("returns a stored transcript without exposing storage paths", async () => {
    const recorded = await Recording.create({
      workspaceId: "default",
      originalFilename: "transcribed.wav",
      storageKey: "audio/default/transcribed.wav",
      extension: "wav",
      detectedMimeType: "audio/vnd.wave",
      sizeBytes: 100,
      checksum: "transcribed-checksum",
      status: "transcribed",
      progress: 100,
      durationSeconds: 2,
      preparedAt: new Date(),
      transcriptionAttempts: 1,
      transcript: {
        text: "hello world",
        language: "en",
        durationSeconds: 2,
        provider: "groq",
        model: "whisper-large-v3-turbo",
        processedAt: "2026-11-21T12:00:00.000Z",
        segments: [
          {
            index: 0,
            start: 0,
            end: 2,
            text: "hello world",
            speakerId: null,
          },
        ],
      },
    });
    const id = String(recorded._id);

    const response = await request(app).get(`/api/recordings/${id}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("transcribed");
    expect(response.body.transcriptionAttempts).toBe(1);
    expect(response.body.transcript).toMatchObject({
      text: "hello world",
      language: "en",
      provider: "groq",
      model: "whisper-large-v3-turbo",
    });
    expect(response.body.transcript.segments[0].speakerId).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain("storageKey");
  });

  it("exposes conversation analysis for a recording", async () => {
    const recording = await Recording.create({
      workspaceId: "default",
      originalFilename: "analysed.wav",
      storageKey: "audio/default/analysed.wav",
      extension: "wav",
      detectedMimeType: "audio/vnd.wave",
      sizeBytes: 100,
      checksum: "analysed-checksum",
      status: "analysis_completed",
      preparedAt: new Date(),
      progress: 100,
      transcript: {
        id: "tx-analysed",
        text: "Let us review the roadmap on Friday.",
        language: "en",
        durationSeconds: 4,
        provider: "groq",
        model: "whisper-large-v3-turbo",
        processedAt: new Date().toISOString(),
        segments: [
          {
            id: "seg-analysed-0",
            index: 0,
            start: 0,
            end: 4,
            text: "Let us review the roadmap on Friday.",
            speakerId: null,
          },
        ],
      },
    });
    const id = String(recording._id);
    await ConversationAnalysis.create({
      workspaceId: "default",
      recordingId: id,
      transcriptId: "tx-analysed",
      status: "completed",
      provider: "gemini",
      model: "model-primary",
      fallbackUsed: false,
      attemptedModels: ["model-primary"],
      schemaVersion: "conversation-insights-v1",
      promptVersion: "conversation-analysis-v1",
      summary: "The call included a roadmap review.",
      topics: ["roadmap"],
      insights: [
        {
          category: "task",
          explicitness: "explicit",
          summary: "Review the roadmap on Friday.",
          speakerId: null,
          evidence: {
            recordingId: id,
            segmentId: "seg-analysed-0",
            segmentIndex: 0,
            start: 0,
            end: 4,
            quote: "Let us review the roadmap on Friday.",
          },
        },
      ],
      analyzedAt: new Date(),
    });

    const response = await request(app).get(`/api/recordings/${id}`);

    expect(response.status).toBe(200);
    expect(response.body.analysis).toMatchObject({
      recordingId: id,
      transcriptId: "tx-analysed",
      status: "completed",
      model: "model-primary",
      summary: "The call included a roadmap review.",
      topics: ["roadmap"],
    });
    expect(response.body.analysis.insights).toHaveLength(1);
  });

  it("retries failed transcriptions through the transcription queue", async () => {
    const failed = await Recording.create({
      workspaceId: "default",
      originalFilename: "transcription-failed.wav",
      storageKey: "audio/default/transcription-failed.wav",
      extension: "wav",
      detectedMimeType: "audio/vnd.wave",
      sizeBytes: 100,
      checksum: "transcription-failed-checksum",
      status: "failed",
      preparedAt: new Date(),
      progress: 0,
      error: {
        code: "TRANSCRIPTION_RATE_LIMITED",
        message: "Groq rate limit reached",
      },
    });
    const id = String(failed._id);

    const retried = await request(app).post(`/api/recordings/${id}/retry`);

    expect(retried.status).toBe(200);
    expect(retried.body.status).toBe("transcription_queued");
    expect(retried.body.error).toBeNull();
    expect(enqueueTranscription).toHaveBeenCalledWith(id);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("retries failed analyses through the analysis queue", async () => {
    const failed = await Recording.create({
      workspaceId: "default",
      originalFilename: "analysis-failed.wav",
      storageKey: "audio/default/analysis-failed.wav",
      extension: "wav",
      detectedMimeType: "audio/vnd.wave",
      sizeBytes: 100,
      checksum: "analysis-failed-checksum",
      status: "analysis_failed",
      preparedAt: new Date(),
      progress: 90,
      error: {
        code: "GEMINI_FALLBACK_UNAVAILABLE",
        message: "Gemini was temporarily unavailable",
      },
    });
    const id = String(failed._id);

    const retried = await request(app).post(`/api/recordings/${id}/retry`);

    expect(retried.status).toBe(200);
    expect(retried.body.status).toBe("analysis_queued");
    expect(retried.body.error).toBeNull();
    expect(enqueueAnalysis).toHaveBeenCalledWith(id);
    expect(enqueueTranscription).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("retries failed recordings once and rejects concurrent retries", async () => {
    const failed = await Recording.create({
      workspaceId: "default",
      originalFilename: "failed.wav",
      storageKey: "audio/default/failed.wav",
      extension: "wav",
      detectedMimeType: "audio/vnd.wave",
      sizeBytes: 100,
      checksum: "failed-checksum",
      status: "failed",
      error: { code: "FFPROBE_FAILED", message: "ffprobe failed" },
      attempts: 3,
    });
    const id = String(failed._id);

    const retried = await request(app).post(`/api/recordings/${id}/retry`);
    expect(retried.status).toBe(200);
    expect(retried.body.status).toBe("queued");
    expect(retried.body.error).toBeNull();
    expect(enqueue).toHaveBeenCalledWith(id);

    const conflict = await request(app).post(`/api/recordings/${id}/retry`);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("RETRY_CONFLICT");
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("requires at least one file in an upload request", async () => {
    const response = await request(app).post("/api/recordings/upload");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("NO_FILES");
  });
});
