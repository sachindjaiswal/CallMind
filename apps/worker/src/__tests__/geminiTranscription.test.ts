import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TranscriptionError } from "../lib/groqTranscription";
import {
  parseGeminiTranscriptionResponse,
  transcribeWithGemini,
} from "../lib/geminiTranscription";

const API_KEY = "test-key-not-a-real-secret";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Gemini transcription adapter", () => {
  it("normalizes transcription parts, word offsets, and speaker labels", () => {
    const result = parseGeminiTranscriptionResponse(
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "अभी मैं 10 मिनट में मलाड स्टेशन पहुंच जाऊंगा।",
                  audioTranscription: {
                    text: "अभी मैं 10 मिनट में मलाड स्टेशन पहुंच जाऊंगा।",
                    speakerLabel: "spk:0",
                    words: [
                      { startOffset: "0.800s", endOffset: "1.100s" },
                      { startOffset: "3.400s", endOffset: "3.600s" },
                    ],
                  },
                },
                {
                  text: "हां?",
                  audioTranscription: {
                    text: "हां?",
                    speakerLabel: "spk:1",
                    words: [{ startOffset: "4.900s", endOffset: "5s" }],
                  },
                },
              ],
            },
          },
        ],
      },
      {
        model: "gemini-3.5-transcribe",
        recordingId: "recording-1",
      },
    );

    expect(result).toMatchObject({
      id: "tx-recording-1",
      language: "hi",
      provider: "gemini",
      model: "gemini-3.5-transcribe",
      durationSeconds: 5,
    });
    expect(result.text).toBe(
      "अभी मैं 10 मिनट में मलाड स्टेशन पहुंच जाऊंगा। हां?",
    );
    expect(result.segments).toMatchObject([
      {
        id: "seg-recording-1-0",
        index: 0,
        start: 0.8,
        end: 3.6,
        speakerId: "spk:0",
      },
      {
        id: "seg-recording-1-1",
        index: 1,
        start: 4.9,
        end: 5,
        speakerId: "spk:1",
      },
    ]);
  });

  it("posts inline audio with diarization and word timestamps enabled", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "callmind-gemini-"));
    const filePath = join(storageRoot, "sample.wav");
    await writeFile(filePath, Buffer.from("fake audio"));

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "hello world",
                    audioTranscription: {
                      words: [
                        { startOffset: "0s", endOffset: "1s" },
                        { startOffset: "1s", endOffset: "2s" },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await transcribeWithGemini(filePath, {
        apiKey: API_KEY,
        model: "gemini-3.5-transcribe",
        maxBytes: 1024,
        recordingId: "recording-1",
        languageHint: "en",
      });

      expect(result.text).toBe("hello world");
      expect(result.language).toBe("en");
      expect(result.provider).toBe("gemini");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent",
      );
      expect(url).toContain(encodeURIComponent(API_KEY));
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({ "Content-Type": "application/json" });

      const body = JSON.parse(String(init.body)) as {
        contents: Array<{
          parts: Array<{
            inlineData: { mimeType: string; data: string };
          }>;
        }>;
        generationConfig: {
          audioTranscriptionConfig: {
            diarization: boolean;
            wordTimestamp: boolean;
          };
        };
      };

      expect(body.contents[0].parts[0].inlineData.mimeType).toBe("audio/wav");
      expect(body.generationConfig.audioTranscriptionConfig).toEqual({
        diarization: true,
        wordTimestamp: true,
      });
    } finally {
      await rm(storageRoot, { recursive: true, force: true });
    }
  });

  it("rejects a missing API key without making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeWithGemini("sample.wav", {
        apiKey: "",
        model: "gemini-3.5-transcribe",
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
    const storageRoot = await mkdtemp(join(tmpdir(), "callmind-gemini-error-"));
    const filePath = join(storageRoot, "sample.wav");
    await writeFile(filePath, Buffer.from("fake audio"));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { message: `Invalid key: ${API_KEY}` } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    try {
      const error = await transcribeWithGemini(filePath, {
        apiKey: API_KEY,
        model: "gemini-3.5-transcribe",
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
