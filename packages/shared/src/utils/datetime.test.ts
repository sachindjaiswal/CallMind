import { describe, expect, it } from "vitest";
import {
  getDateInTimeZone,
  getZonedDateRange,
  isInstantInReportDate,
} from "./datetime";

describe("report date and timezone helpers", () => {
  it("uses explicit UTC boundaries", () => {
    const range = getZonedDateRange("2026-11-21", "UTC");
    expect(range.start.toISOString()).toBe("2026-11-21T00:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-11-22T00:00:00.000Z");
  });

  it("uses local midnight for a non-UTC timezone", () => {
    const range = getZonedDateRange("2026-11-21", "Asia/Kolkata");
    expect(range.start.toISOString()).toBe("2026-11-20T18:30:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-11-21T18:30:00.000Z");
  });

  it("handles daylight saving transitions", () => {
    const range = getZonedDateRange("2026-03-08", "America/New_York");
    expect(range.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(range.endExclusive.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("does not assume UTC when assigning an instant to a date", () => {
    expect(
      isInstantInReportDate("2026-11-21T20:00:00.000Z", "2026-11-21", "Asia/Kolkata"),
    ).toBe(false);
    expect(getDateInTimeZone("2026-11-21T20:00:00.000Z", "Asia/Kolkata")).toBe(
      "2026-11-22",
    );
  });

  it("rejects invalid dates and timezones", () => {
    expect(() => getZonedDateRange("2026-02-30", "UTC")).toThrow();
    expect(() => getZonedDateRange("2026-11-21", "Not/AZone")).toThrow();
  });
});
