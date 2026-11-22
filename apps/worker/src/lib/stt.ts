import type {
  SttLanguageHint,
  SttStrategy,
  TranscriptDto,
  TranscriptProvider,
} from "@callmind/shared";
import {
  transcribeWithGemini,
  type GeminiTranscriptionConfig,
} from "./geminiTranscription";
import {
  transcribeWithGroq,
  type GroqTranscriptionConfig,
} from "./groqTranscription";

export interface SttTranscriberConfig {
  strategy: SttStrategy;
  groq: Omit<GroqTranscriptionConfig, "recordingId">;
  gemini: Omit<GeminiTranscriptionConfig, "recordingId" | "languageHint">;
}

export type SttTranscriber = (
  filePath: string,
  recordingId: string,
  languageHint?: SttLanguageHint,
) => Promise<TranscriptDto>;

export function resolveSttProvider(
  strategy: SttStrategy,
  languageHint: SttLanguageHint = "auto",
): TranscriptProvider {
  if (strategy === "groq-only" || languageHint === "en") {
    return "groq";
  }
  return "gemini";
}

export function createSttTranscriber(
  config: SttTranscriberConfig,
): SttTranscriber {
  return async (filePath, recordingId, languageHint = "auto") => {
    const provider = resolveSttProvider(config.strategy, languageHint);

    if (provider === "groq") {
      return transcribeWithGroq(filePath, {
        ...config.groq,
        recordingId,
      });
    }

    return transcribeWithGemini(filePath, {
      ...config.gemini,
      recordingId,
      languageHint,
    });
  };
}
