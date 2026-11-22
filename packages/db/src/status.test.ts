import { describe, expect, it } from "vitest";
import {
  RECORDING_STATUS_TRANSITIONS,
  canTransitionRecording,
} from "./status";

describe("recording status transitions", () => {
  it("allows the happy path", () => {
    expect(canTransitionRecording("uploaded", "queued")).toBe(true);
    expect(canTransitionRecording("queued", "processing")).toBe(true);
    expect(
      canTransitionRecording("processing", "ready_for_transcription"),
    ).toBe(true);
    expect(
      canTransitionRecording(
        "ready_for_transcription",
        "transcription_queued",
      ),
    ).toBe(true);
    expect(canTransitionRecording("transcription_queued", "transcribing")).toBe(
      true,
    );
    expect(canTransitionRecording("transcribing", "transcribed")).toBe(true);
  });

  it("allows retryable failures to return to the queue", () => {
    expect(canTransitionRecording("processing", "queued")).toBe(true);
    expect(canTransitionRecording("processing", "failed")).toBe(true);
    expect(canTransitionRecording("failed", "queued")).toBe(true);
  });

  it("allows transcription retries and continues into analysis", () => {
    expect(canTransitionRecording("transcribing", "transcription_queued")).toBe(
      true,
    );
    expect(canTransitionRecording("failed", "transcription_queued")).toBe(true);
    expect(canTransitionRecording("transcribed", "analysis_queued")).toBe(true);
    expect(canTransitionRecording("transcribed", "queued")).toBe(false);
  });

  it("allows analysis retries without replaying earlier stages", () => {
    expect(canTransitionRecording("analysis_queued", "analyzing")).toBe(true);
    expect(canTransitionRecording("analyzing", "analysis_completed")).toBe(true);
    expect(canTransitionRecording("analyzing", "analysis_failed")).toBe(true);
    expect(canTransitionRecording("analysis_failed", "analysis_queued")).toBe(
      true,
    );
    expect(
      canTransitionRecording("analysis_completed", "analysis_queued"),
    ).toBe(true);
    expect(
      canTransitionRecording("analysis_failed", "ready_for_transcription"),
    ).toBe(false);
  });

  it("rejects skipping preparation", () => {
    expect(canTransitionRecording("uploaded", "processing")).toBe(false);
    expect(canTransitionRecording("queued", "ready_for_transcription")).toBe(
      false,
    );
  });
});
