import { describe, expect, it } from "vitest";
import { processTestJobData } from "../queues/test";

describe("processTestJobData", () => {
  it("echoes the message and reports success", () => {
    const result = processTestJobData({
      message: "hello",
      requestedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(result.message).toBe("hello");
  });

  it("returns an ISO timestamp for processedAt", () => {
    const result = processTestJobData({
      message: "hello",
      requestedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(Number.isNaN(Date.parse(result.processedAt))).toBe(false);
    expect(result.processedAt).toContain("T");
  });
});
