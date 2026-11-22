import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
import {
  createRecordingPrepareProcessor,
  type RecordingPrepareJob,
} from "../queues/recordingPrepare";

const VALID_FFPROBE = `#!/bin/sh
cat <<'JSON'
{"format":{"format_name":"wav","duration":"12.5","bit_rate":"128000"},"streams":[{"codec_type":"audio","codec_name":"pcm_s16le","sample_rate":"8000","channels":1}]}
JSON
`;

function makeJob(
  recordingId: string,
  options: { attemptsMade?: number; attempts?: number } = {},
): RecordingPrepareJob {
  return {
    id: "job-1",
    data: { recordingId },
    attemptsMade: options.attemptsMade ?? 0,
    opts: { attempts: options.attempts ?? 3 },
  } as unknown as RecordingPrepareJob;
}

describe("recording preparation processor", () => {
  let mongoServer: MongoMemoryServer;
  let storageRoot: string;
  let ffprobePath: string;
  let brokenFfprobePath: string;
  let invalidFfprobePath: string;
  let enqueueTranscription: ReturnType<typeof vi.fn>;
  let processor: ReturnType<typeof createRecordingPrepareProcessor>;

  async function createQueuedRecording(
    storageKey: string,
    checksum: string,
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
      status: "queued",
    });

    return String(recording._id);
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri("callmind"));
    storageRoot = await mkdtemp(join(tmpdir(), "callmind-worker-"));

    ffprobePath = join(storageRoot, "ffprobe-ok");
    brokenFfprobePath = join(storageRoot, "ffprobe-broken");
    invalidFfprobePath = join(storageRoot, "ffprobe-invalid");

    await writeFile(ffprobePath, VALID_FFPROBE, { mode: 0o755 });
    await chmod(ffprobePath, 0o755);
    await writeFile(brokenFfprobePath, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    await chmod(brokenFfprobePath, 0o755);
    await writeFile(invalidFfprobePath, "#!/bin/sh\necho not-json\n", {
      mode: 0o755,
    });
    await chmod(invalidFfprobePath, 0o755);

    enqueueTranscription = vi.fn(async (_recordingId: string) => undefined);
    processor = createRecordingPrepareProcessor({
      storageRoot,
      ffprobePath,
      enqueueTranscription: (recordingId) => enqueueTranscription(recordingId),
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
    enqueueTranscription.mockClear();
  });

  it("probes audio and moves the recording to ready_for_transcription", async () => {
    const id = await createQueuedRecording("audio/default/ok.wav", "ok-1");

    const result = await processor(makeJob(id));

    expect(result).toMatchObject({
      ok: true,
      recordingId: id,
      durationSeconds: 12.5,
    });

    const recording = await Recording.findById(id).lean();
    expect(recording?.status).toBe("ready_for_transcription");
    expect(recording?.progress).toBe(100);
    expect(recording?.attempts).toBe(1);
    expect(recording?.durationSeconds).toBe(12.5);
    expect(recording?.metadata).toMatchObject({
      codec: "pcm_s16le",
      sampleRate: 8000,
      channels: 1,
    });
    expect(recording?.preparedAt).toBeInstanceOf(Date);
    expect(enqueueTranscription).toHaveBeenCalledWith(id);
  });

  it("is idempotent when a job is delivered twice", async () => {
    const id = await createQueuedRecording("audio/default/twice.wav", "ok-2");

    const first = await processor(makeJob(id));
    const second = await processor(makeJob(id));

    expect(first.skipped).toBeUndefined();
    expect(second.skipped).toBe(true);

    const recording = await Recording.findById(id).lean();
    expect(recording?.attempts).toBe(1);
  });

  it("requeues a retryable failure and fails on the final attempt", async () => {
    const id = await createQueuedRecording("audio/default/missing.wav", "miss-1");
    await rm(resolve(storageRoot, "audio/default/missing.wav"));

    const retryableProcessor = processor;
    await expect(retryableProcessor(makeJob(id))).rejects.toThrow(
      /stored audio file is missing/i,
    );

    let recording = await Recording.findById(id).lean();
    expect(recording?.status).toBe("queued");
    expect(recording?.attempts).toBe(1);
    expect(recording?.error?.code).toBe("FILE_MISSING");

    await expect(
      retryableProcessor(makeJob(id, { attemptsMade: 2 })),
    ).rejects.toThrow(/stored audio file is missing/i);

    recording = await Recording.findById(id).lean();
    expect(recording?.status).toBe("failed");
    expect(recording?.attempts).toBe(2);
  });

  it("treats invalid ids and missing recordings as unrecoverable", async () => {
    await expect(processor(makeJob("not-an-id"))).rejects.toThrowError(
      UnrecoverableError,
    );
    await expect(
      processor(makeJob("64b7f9c2e1b2a4d5f6a7b8c9")),
    ).rejects.toThrowError(UnrecoverableError);
    expect(await Recording.countDocuments({})).toBe(0);
  });

  it("requeues when ffprobe fails or returns invalid output", async () => {
    const failId = await createQueuedRecording(
      "audio/default/broken.wav",
      "probe-1",
    );
    const failingProcessor = createRecordingPrepareProcessor({
      storageRoot,
      ffprobePath: brokenFfprobePath,
      enqueueTranscription: (recordingId) => enqueueTranscription(recordingId),
    });

    await expect(failingProcessor(makeJob(failId))).rejects.toThrow(/ffprobe failed/i);
    let recording = await Recording.findById(failId).lean();
    expect(recording?.status).toBe("queued");
    expect(recording?.error?.code).toBe("FFPROBE_FAILED");

    const invalidId = await createQueuedRecording(
      "audio/default/invalid.wav",
      "probe-2",
    );
    const invalidProcessor = createRecordingPrepareProcessor({
      storageRoot,
      ffprobePath: invalidFfprobePath,
      enqueueTranscription: (recordingId) => enqueueTranscription(recordingId),
    });

    await expect(invalidProcessor(makeJob(invalidId))).rejects.toThrow(
      /invalid JSON/i,
    );
    recording = await Recording.findById(invalidId).lean();
    expect(recording?.status).toBe("queued");
    expect(recording?.error?.code).toBe("FFPROBE_INVALID_OUTPUT");
  });
});
