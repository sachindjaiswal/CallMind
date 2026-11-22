import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GeminiAnalysisError,
  generateGeminiStructuredResponse,
} from "../lib/geminiAnalysis";

const API_KEY = "test-key-not-a-real-secret";
const PROMPT = "Analyse the transcript.";
const SCHEMA = { type: "OBJECT", properties: { summary: { type: "STRING" } } };

function structuredResponse(value: unknown): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Gemini analysis adapter", () => {
  it("requests structured JSON with responseSchema and parses the result", async () => {
    const fetchMock = vi.fn(async () => structuredResponse({ summary: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateGeminiStructuredResponse(
      {
        prompt: PROMPT,
        responseSchema: SCHEMA,
        parse: (value) => value as { summary: string },
      },
      {
        apiKey: API_KEY,
        primaryModel: "primary-model",
        fallbackModel: "fallback-model",
      },
    );

    expect(result).toMatchObject({
      data: { summary: "ok" },
      model: "primary-model",
      fallbackUsed: false,
      attemptedModels: ["primary-model"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("primary-model");
    expect(url).toContain("generateContent");
    const body = JSON.parse(String(init.body)) as {
      generationConfig: {
        responseMimeType: string;
        responseSchema: Record<string, unknown>;
      };
    };
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toEqual(SCHEMA);
  });

  it("uses the fallback model after temporary primary failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "temporarily down" } }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "temporarily down" } }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(structuredResponse({ summary: "fallback ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const sleep = vi.fn(async () => undefined);

    const result = await generateGeminiStructuredResponse(
      {
        prompt: PROMPT,
        responseSchema: SCHEMA,
        parse: (value) => value as { summary: string },
      },
      {
        apiKey: API_KEY,
        primaryModel: "primary-model",
        fallbackModel: "fallback-model",
        sleep,
      },
    );

    expect(result).toMatchObject({
      data: { summary: "fallback ok" },
      model: "fallback-model",
      fallbackUsed: true,
      attemptedModels: ["primary-model", "fallback-model"],
    });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("fallback-model");
  });

  it("does not fall back for authentication failures", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "bad key" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await generateGeminiStructuredResponse(
      {
        prompt: PROMPT,
        responseSchema: SCHEMA,
        parse: (value) => value as { summary: string },
      },
      {
        apiKey: API_KEY,
        primaryModel: "primary-model",
        fallbackModel: "fallback-model",
      },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GeminiAnalysisError);
    expect(error).toMatchObject({
      code: "GEMINI_AUTHENTICATION_FAILED",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not fall back for malformed structured output", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "{not json" }] } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await generateGeminiStructuredResponse(
      {
        prompt: PROMPT,
        responseSchema: SCHEMA,
        parse: (value) => value as { summary: string },
      },
      {
        apiKey: API_KEY,
        primaryModel: "primary-model",
        fallbackModel: "fallback-model",
      },
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "GEMINI_INVALID_RESPONSE",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an exhausted temporary failure without a configured fallback", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const sleep = vi.fn(async () => undefined);

    const error = await generateGeminiStructuredResponse(
      {
        prompt: PROMPT,
        responseSchema: SCHEMA,
        parse: (value) => value as { summary: string },
      },
      {
        apiKey: API_KEY,
        primaryModel: "primary-model",
        sleep,
      },
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "GEMINI_PRIMARY_UNAVAILABLE",
      retryable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
