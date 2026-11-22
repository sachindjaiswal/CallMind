import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TranscriptionError,
  parseGroqTranscriptionResponse,
  transcribeWithGroq,
} from "../lib/groqTranscription";

const API_KEY = "test-key-not-a-real-secret";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Groq transcription adapter", () => {
  it("normalizes verbose_json responses", () => {
    const result = parseGroqTranscriptionResponse(
      {
        duration: 2,
        language: "en",
        text: " hello ",
        segments: [
          {
            id: 0,
            start: 0,
            end: 2,
            text: " hello ",
          },
        ],
      },
      "whisper-large-v3-turbo",
      "recording-1",
    );

    expect(result).toMatchObject({
      id: "tx-recording-1",
      text: " hello ",
      language: "en",
      durationSeconds: 2,
      provider: "groq",
      model: "whisper-large-v3-turbo",
    });
    expect(result.segments).toEqual([
      {
        id: "seg-recording-1-0",
        index: 0,
        start: 0,
        end: 2,
        text: "hello",
        speakerId: null,
      },
    ]);
    expect(Number.isNaN(Date.parse(result.processedAt))).toBe(false);
  });

  it("posts multipart data and returns a transcript", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "callmind-groq-"));
    const filePath = join(storageRoot, "sample.wav");
    await writeFile(filePath, Buffer.from("fake audio"));

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          duration: 1.5,
          language: "en",
          text: "hello world",
          segments: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await transcribeWithGroq(filePath, {
        apiKey: API_KEY,
        model: "whisper-large-v3-turbo",
        maxBytes: 1024,
        recordingId: "recording-1",
      });

      expect(result.text).toBe("hello world");
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]).toMatchObject({ speakerId: null });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://api.groq.com/openai/v1/audio/transcriptions",
      );
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({
        Accept: "application/json",
        Authorization: `Bearer ${API_KEY}`,
      });
      const body = String(init.body);
      expect(body).toContain('name="response_format"');
      expect(body).toContain("verbose_json");
      expect(body).toContain("whisper-large-v3-turbo");
    } finally {
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it("rejects a missing API key without making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeWithGroq("sample.wav", {
        apiKey: "",
        model: "whisper-large-v3-turbo",
        maxBytes: 1024,
        recordingId: "recording-1",
      }),
    ).rejects.toMatchObject({
      code: "TRANSCRIPTION_NOT_CONFIGURED",
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps provider errors and redacts API keys", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "callmind-groq-error-"));
    const filePath = join(storageRoot, "sample.wav");
    await writeFile(filePath, Buffer.from("fake audio"));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: { message: `Invalid key: ${API_KEY}` },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    try {
      const error = await transcribeWithGroq(filePath, {
        apiKey: API_KEY,
        model: "whisper-large-v3-turbo",
        maxBytes: 1024,
        recordingId: "recording-1",
      }).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(TranscriptionError);
      expect(error).toMatchObject({
        code: "TRANSCRIPTION_UNAUTHORIZED",
        retryable: false,
      });
      expect((error as Error).message).not.toContain(API_KEY);
    } finally {
      await rm(storageRoot, { recursive: true, force: true });
    }
  });
});
