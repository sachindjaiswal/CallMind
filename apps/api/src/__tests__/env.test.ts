import { describe, expect, it } from "vitest";
import { loadEnv } from "../config/env";

const validEnv = {
  NODE_ENV: "test",
  PORT: "8080",
  MONGODB_URI: "mongodb://localhost:27018/callmind",
  REDIS_URL: "redis://localhost:6380",
  CORS_ORIGIN: "http://localhost:5174",
  LOG_LEVEL: "info",
};

describe("loadEnv", () => {
  it("parses a valid environment and coerces PORT to a number", () => {
    const env = loadEnv(validEnv);
    expect(env.PORT).toBe(8080);
    expect(env.NODE_ENV).toBe("test");
  });

  it("applies defaults for optional values", () => {
    const env = loadEnv({
      MONGODB_URI: validEnv.MONGODB_URI,
      REDIS_URL: validEnv.REDIS_URL,
    });
    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.CORS_ORIGIN).toBe("http://localhost:5174");
    expect(env.MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(env.MAX_FILES_PER_UPLOAD).toBe(20);
    expect(env.WORKSPACE_ID).toBe("default");
    expect(env.GEMINI_API_KEY).toBe("");
    expect(env.GEMINI_MODEL).toBe("gemini-3.8-flash");
    expect(env.GROQ_API_KEY).toBe("");
    expect(env.GROQ_STT_MODEL).toBe("whisper-large-v3-turbo");
    expect(env.GROQ_STT_MAX_BYTES).toBe(25 * 1024 * 1024);
  });

  it("fails when required values are missing", () => {
    expect(() => loadEnv({})).toThrow(/MONGODB_URI/);
  });

  it("rejects an invalid log level", () => {
    expect(() => loadEnv({ ...validEnv, LOG_LEVEL: "verbose" })).toThrow(
      /LOG_LEVEL/,
    );
  });

  it("allows empty provider keys during configuration preparation", () => {
    const env = loadEnv({
      ...validEnv,
      GEMINI_API_KEY: "",
      GROQ_API_KEY: "",
    });
    expect(env.GEMINI_API_KEY).toBe("");
    expect(env.GROQ_API_KEY).toBe("");
  });

  it("rejects a non-positive Groq STT byte limit", () => {
    expect(() =>
      loadEnv({ ...validEnv, GROQ_STT_MAX_BYTES: "0" }),
    ).toThrow(/GROQ_STT_MAX_BYTES/);
  });
});
