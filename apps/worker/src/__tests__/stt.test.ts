import type { TranscriptDto } from "@callmind/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeWithGemini } from "../lib/geminiTranscription";
import { transcribeWithGroq } from "../lib/groqTranscription";
import {
  createSttTranscriber,
  resolveSttProvider,
} from "../lib/stt";

vi.mock("../lib/groqTranscription", () => ({
  transcribeWithGroq: vi.fn(),
}));

vi.mock("../lib/geminiTranscription", () => ({
  transcribeWithGemini: vi.fn(),
}));

const GROQ_TRANSCRIPT: TranscriptDto = {
  id: "tx-groq",
  text: "hello",
  language: "en",
  durationSeconds: 1,
  provider: "groq",
  model: "groq-model",
  processedAt: "2026-11-21T12:00:00.000Z",
  segments: [],
};

const GEMINI_TRANSCRIPT: TranscriptDto = {
  id: "tx-gemini",
  text: "नमस्ते",
  language: "hi",
  durationSeconds: 1,
  provider: "gemini",
  model: "gemini-model",
  processedAt: "2026-11-21T12:00:00.000Z",
  segments: [],
};

describe("STT routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transcribeWithGroq).mockResolvedValue(GROQ_TRANSCRIPT);
    vi.mocked(transcribeWithGemini).mockResolvedValue(GEMINI_TRANSCRIPT);
  });

  it("routes explicit English to Groq", () => {
    expect(resolveSttProvider("language-aware", "en")).toBe("groq");
  });

  it("routes auto and non-English to Gemini", () => {
    expect(resolveSttProvider("language-aware", "auto")).toBe("gemini");
    expect(resolveSttProvider("language-aware", "hi")).toBe("gemini");
  });

  it("keeps the legacy strategy on Groq for every hint", () => {
    expect(resolveSttProvider("groq-only", "auto")).toBe("groq");
    expect(resolveSttProvider("groq-only", "hi")).toBe("groq");
  });

  it("calls Groq for explicit English recordings", async () => {
    const transcriber = createSttTranscriber({
      strategy: "language-aware",
      groq: { apiKey: "groq-key", model: "groq-model", maxBytes: 1000 },
      gemini: {
        apiKey: "gemini-key",
        model: "gemini-model",
        maxBytes: 1000,
      },
    });

    const result = await transcriber("sample.wav", "recording-1", "en");

    expect(result).toBe(GROQ_TRANSCRIPT);
    expect(transcribeWithGroq).toHaveBeenCalledWith("sample.wav", {
      apiKey: "groq-key",
      model: "groq-model",
      maxBytes: 1000,
      recordingId: "recording-1",
    });
    expect(transcribeWithGemini).not.toHaveBeenCalled();
  });

  it("calls Gemini for auto and Hindi recordings", async () => {
    const transcriber = createSttTranscriber({
      strategy: "language-aware",
      groq: { apiKey: "groq-key", model: "groq-model", maxBytes: 1000 },
      gemini: {
        apiKey: "gemini-key",
        model: "gemini-model",
        maxBytes: 1000,
        ffmpegPath: "ffmpeg",
      },
    });

    const auto = await transcriber("sample.mp4", "recording-1");
    const hindi = await transcriber("sample.wav", "recording-2", "hi");

    expect(auto).toBe(GEMINI_TRANSCRIPT);
    expect(hindi).toBe(GEMINI_TRANSCRIPT);
    expect(transcribeWithGemini).toHaveBeenCalledWith("sample.mp4", {
      apiKey: "gemini-key",
      model: "gemini-model",
      maxBytes: 1000,
      ffmpegPath: "ffmpeg",
      recordingId: "recording-1",
      languageHint: "auto",
    });
    expect(transcribeWithGemini).toHaveBeenCalledWith("sample.wav", {
      apiKey: "gemini-key",
      model: "gemini-model",
      maxBytes: 1000,
      ffmpegPath: "ffmpeg",
      recordingId: "recording-2",
      languageHint: "hi",
    });
    expect(transcribeWithGroq).not.toHaveBeenCalled();
  });
});
