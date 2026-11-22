import {
  GEMINI_MODEL_ATTEMPTS,
  GEMINI_RETRY_BASE_MS,
  GEMINI_TIMEOUT_MS,
} from "@callmind/shared";

const MAX_ERROR_MESSAGE_LENGTH = 500;

export interface GeminiAdapterConfig {
  apiKey: string;
  primaryModel: string;
  fallbackModel?: string;
  timeoutMs?: number;
  maxAttemptsPerModel?: number;
  retryBaseMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface GeminiStructuredRequest<T> {
  prompt: string;
  responseSchema: Record<string, unknown>;
  parse: (value: unknown) => T;
}

export interface GeminiStructuredResult<T> {
  data: T;
  model: string;
  fallbackUsed: boolean;
  attemptedModels: string[];
}

export class GeminiAnalysisError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly model: string;
  readonly attemptedModels: string[];

  constructor(options: {
    message: string;
    code: string;
    retryable: boolean;
    model?: string;
    status?: number;
    attemptedModels?: string[];
  }) {
    super(options.message);
    this.name = "GeminiAnalysisError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.model = options.model ?? "unknown";
    this.status = options.status;
    this.attemptedModels = options.attemptedModels ?? [];
  }
}

function redact(value: string, apiKey: string): string {
  const withoutKey = apiKey ? value.split(apiKey).join("[redacted]") : value;
  return withoutKey.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function mapStatus(status: number): { code: string; retryable: boolean } {
  if (status === 401 || status === 403) {
    return { code: "GEMINI_AUTHENTICATION_FAILED", retryable: false };
  }
  if (status === 400 || status === 404 || status === 422) {
    return { code: "GEMINI_INVALID_REQUEST", retryable: false };
  }
  if (status === 429) {
    return { code: "GEMINI_RATE_LIMITED", retryable: true };
  }
  if (status >= 500) {
    return { code: "GEMINI_TEMPORARY_UNAVAILABLE", retryable: true };
  }
  return { code: "GEMINI_REQUEST_FAILED", retryable: false };
}

async function readProviderError(
  response: Response,
  apiKey: string,
): Promise<string> {
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    try {
      return redact(await response.text(), apiKey);
    } catch {
      return `Gemini analysis failed with HTTP ${response.status}.`;
    }
  }

  const message =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
      ? body.error.message
      : `Gemini analysis failed with HTTP ${response.status}.`;

  return redact(message, apiKey);
}

function buildUrl(model: string, apiKey: string): string {
  const encodedModel = encodeURIComponent(model);
  const encodedKey = encodeURIComponent(apiKey);
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodedKey}`;
}

interface GeminiResponsePayload {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: unknown }>;
    };
  }>;
}

function extractText(payload: GeminiResponsePayload): string {
  const parts = payload.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

async function callModel<T>(
  request: GeminiStructuredRequest<T>,
  config: GeminiAdapterConfig,
  model: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildUrl(model, config.apiKey), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: request.responseSchema,
          temperature: 0.2,
        },
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? GEMINI_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error.";
    throw new GeminiAnalysisError({
      message: redact(detail, config.apiKey),
      code: "GEMINI_REQUEST_FAILED",
      retryable: true,
      model,
    });
  }

  if (!response.ok) {
    const mapped = mapStatus(response.status);
    throw new GeminiAnalysisError({
      message: await readProviderError(response, config.apiKey),
      code: mapped.code,
      retryable: mapped.retryable,
      status: response.status,
      model,
    });
  }

  let payload: GeminiResponsePayload;
  try {
    payload = (await response.json()) as GeminiResponsePayload;
  } catch {
    throw new GeminiAnalysisError({
      message: "Gemini returned an invalid JSON response.",
      code: "GEMINI_INVALID_RESPONSE",
      retryable: false,
      model,
    });
  }

  const text = extractText(payload);
  if (!text) {
    throw new GeminiAnalysisError({
      message: "Gemini returned no structured content.",
      code: "GEMINI_INVALID_RESPONSE",
      retryable: false,
      model,
    });
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GeminiAnalysisError({
      message: "Gemini returned malformed structured JSON.",
      code: "GEMINI_INVALID_RESPONSE",
      retryable: false,
      model,
    });
  }

  try {
    return request.parse(json);
  } catch {
    throw new GeminiAnalysisError({
      message: "Gemini structured output failed schema validation.",
      code: "GEMINI_INVALID_RESPONSE",
      retryable: false,
      model,
    });
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function generateGeminiStructuredResponse<T>(
  request: GeminiStructuredRequest<T>,
  config: GeminiAdapterConfig,
): Promise<GeminiStructuredResult<T>> {
  if (!config.apiKey) {
    throw new GeminiAnalysisError({
      message: "Gemini API key is not configured.",
      code: "GEMINI_NOT_CONFIGURED",
      retryable: false,
    });
  }

  const fallbackModel = config.fallbackModel?.trim();
  const models = [config.primaryModel];
  if (fallbackModel && fallbackModel !== config.primaryModel) {
    models.push(fallbackModel);
  }

  const maxAttempts = config.maxAttemptsPerModel ?? GEMINI_MODEL_ATTEMPTS;
  const retryBaseMs = config.retryBaseMs ?? GEMINI_RETRY_BASE_MS;
  const sleep = config.sleep ?? delay;
  const attemptedModels: string[] = [];

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    attemptedModels.push(model);
    let lastError: GeminiAnalysisError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const data = await callModel(request, config, model);
        return {
          data,
          model,
          fallbackUsed: modelIndex > 0,
          attemptedModels,
        };
      } catch (error) {
        const failed =
          error instanceof GeminiAnalysisError
            ? error
            : new GeminiAnalysisError({
                message: error instanceof Error ? error.message : "Unknown error.",
                code: "GEMINI_REQUEST_FAILED",
                retryable: true,
                model,
              });
        lastError = failed;

        if (!failed.retryable) {
          throw failed;
        }

        if (attempt < maxAttempts) {
          await sleep(retryBaseMs * 2 ** (attempt - 1));
        }
      }
    }

    if (modelIndex === models.length - 1) {
      const code = models.length > 1 ? "GEMINI_FALLBACK_UNAVAILABLE" : "GEMINI_PRIMARY_UNAVAILABLE";
      throw new GeminiAnalysisError({
        message: `${code}: ${lastError?.message ?? "Gemini analysis failed."}`,
        code,
        retryable: true,
        model,
        attemptedModels,
      });
    }
  }

  throw new GeminiAnalysisError({
    message: "Gemini analysis failed.",
    code: "GEMINI_ANALYSIS_FAILED",
    retryable: false,
    attemptedModels,
  });
}
