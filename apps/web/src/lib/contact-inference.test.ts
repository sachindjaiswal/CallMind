import { describe, expect, it } from "vitest";
import { inferContactFromFilename } from "./contact-inference";

describe("inferContactFromFilename", () => {
  it.each([
    ["Rahul Sharma.mp3", "Rahul Sharma"],
    ["Call with Priya.m4a", "Priya"],
    ["Amit_22_Nov_2026.mp3", "Amit"],
    ["Incoming_9876543210.wav", null],
    ["Recording_001.mp3", null],
    ["Priya - 2026-11-22 14.30.mp3", "Priya"],
    ["+91 98765 43210.wav", null],
  ])("infers the expected name from %s", (filename, expected) => {
    expect(inferContactFromFilename(filename).name).toBe(expected);
  });

  it("extracts only the basename from Unix and Windows paths", () => {
    expect(
      inferContactFromFilename("/home/me/recordings/Call with Priya.m4a"),
    ).toMatchObject({
      name: "Priya",
      source: "filename",
    });
    expect(
      inferContactFromFilename(
        String.raw`C:\Users\Me\Recordings\Rahul Sharma.mp3`,
      ),
    ).toMatchObject({
      name: "Rahul Sharma",
    });
  });

  it("returns a safe null result for empty, whitespace and path-only inputs", () => {
    expect(inferContactFromFilename("")).toMatchObject({
      name: null,
      confidence: "low",
      source: "filename",
      reason: "generic_only",
    });
    expect(inferContactFromFilename("   ").name).toBeNull();
    expect(inferContactFromFilename("/tmp/recordings/").name).toBeNull();
  });

  it("rejects generic-only names", () => {
    expect(inferContactFromFilename("Call.mp3").name).toBeNull();
    expect(inferContactFromFilename("Recording Audio.wav").name).toBeNull();
    expect(inferContactFromFilename("Voice note.m4a").name).toBeNull();
    expect(inferContactFromFilename("Incoming - Outgoing.mp3").name).toBeNull();
    expect(inferContactFromFilename("voicemail.mp3").name).toBeNull();
  });

  it("rejects phone numbers and numeric identifiers", () => {
    expect(inferContactFromFilename("9876543210.mp3")).toMatchObject({
      name: null,
      reason: "phone_or_numeric_only",
    });
    expect(inferContactFromFilename("001.wav").name).toBeNull();
    expect(inferContactFromFilename("Recording 20261122.mp3").name).toBeNull();
  });

  it("removes recognized and unknown extensions case-insensitively", () => {
    expect(inferContactFromFilename("Priya.MP3").name).toBe("Priya");
    expect(inferContactFromFilename("Priya.M4A").name).toBe("Priya");
    expect(inferContactFromFilename("Priya.xyz").name).toBe("Priya");
    expect(inferContactFromFilename("Priya.txt").name).toBe("Priya");
  });

  it("normalizes Unicode while preserving a Unicode name", () => {
    expect(
      inferContactFromFilename("Jose\u0301_A\u0301lvarez.mp3").name,
    ).toBe("José Álvarez");
    expect(inferContactFromFilename("राहुल_शर्मा.mp3").name).toBe(
      "राहुल शर्मा",
    );
  });

  it("handles prefixes and extensions regardless of case", () => {
    expect(inferContactFromFilename("CALL WITH PRIYA.MP3").name).toBe("PRIYA");
    expect(inferContactFromFilename("Incoming_Priya.WAV").name).toBe("Priya");
  });

  it("removes date and time suffixes in common formats", () => {
    expect(inferContactFromFilename("Amit 22 Nov 2026.mp3").name).toBe("Amit");
    expect(
      inferContactFromFilename("Amit 2026-11-22 14.30.mp3").name,
    ).toBe("Amit");
    expect(inferContactFromFilename("Amit_22_11_2026.wav").name).toBe("Amit");
    expect(inferContactFromFilename("Amit Monday 2.30 pm.mp3").name).toBe(
      "Amit",
    );
    expect(inferContactFromFilename("Amit January.mp3").name).toBe("Amit");
  });

  it("keeps legitimate names that look like generic words or months", () => {
    expect(inferContactFromFilename("Callum Smith.mp3").name).toBe(
      "Callum Smith",
    );
    expect(inferContactFromFilename("May Smith.mp3").name).toBe("May Smith");
    expect(inferContactFromFilename("Priya Audio Sharma.mp3").name).toBe(
      "Priya Audio Sharma",
    );
  });

  it("handles repeated separators and whitespace", () => {
    expect(
      inferContactFromFilename("  Call___with---Priya  .M4A  ").name,
    ).toBe("Priya");
    expect(inferContactFromFilename("Rahul...Sharma.mp3").name).toBe(
      "Rahul Sharma",
    );
  });

  it("reports the inference reason and confidence", () => {
    expect(inferContactFromFilename("Rahul Sharma.mp3")).toEqual({
      name: "Rahul Sharma",
      confidence: "medium",
      source: "filename",
      originalFilename: "Rahul Sharma.mp3",
      reason: "name_only",
    });
    expect(inferContactFromFilename("Call with Priya.m4a")).toMatchObject({
      confidence: "medium",
      reason: "name_after_generic_prefix",
    });
    expect(inferContactFromFilename("Amit_22_Nov_2026.mp3")).toMatchObject({
      confidence: "medium",
      reason: "name_with_date_suffix",
    });
    expect(inferContactFromFilename("Priya.MP3")).toMatchObject({
      confidence: "medium",
    });
  });

  it("uses low confidence for initials and ambiguous month names", () => {
    expect(inferContactFromFilename("J. Rao.mp3")).toMatchObject({
      name: "J Rao",
      confidence: "low",
    });
    expect(inferContactFromFilename("May Smith.mp3")).toMatchObject({
      name: "May Smith",
      confidence: "low",
    });
  });

  it("preserves the exact original filename in every result", () => {
    const filename = String.raw` C:\Recordings\Call with Priya.m4a `;
    expect(inferContactFromFilename(filename).originalFilename).toBe(filename);
    expect(inferContactFromFilename("").originalFilename).toBe("");
  });

  it("returns null rather than guessing when a name is too long", () => {
    expect(
      inferContactFromFilename(
        "Rahul Kumar Singh Chauhan Extra Name.mp3",
      ).name,
    ).toBeNull();
    expect(
      inferContactFromFilename(
        "Rahul Sharma With An Extremely Long Additional Contact Name That Exceeds The Limit.mp3",
      ).name,
    ).toBeNull();
  });
});
