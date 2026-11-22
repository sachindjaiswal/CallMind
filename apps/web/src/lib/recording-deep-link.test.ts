import type { RecordingDto, TranscriptSegmentDto } from "@callmind/shared";
import { describe, expect, it } from "vitest";
import {
  findTranscriptSegment,
  mergeRecordings,
  parseRecordingDeepLink,
} from "./recording-deep-link";

const segments: TranscriptSegmentDto[] = [
  { id: "seg-0", index: 0, start: 0, end: 4, text: "first", speakerId: null },
  { id: "seg-1", index: 1, start: 4, end: 9, text: "second", speakerId: null },
  { id: "seg-2", index: 2, start: 9, end: 14, text: "third", speakerId: null },
];

function recording(id: string): RecordingDto {
  return {
    id,
    originalFilename: `${id}.wav`,
  } as RecordingDto;
}

describe("recording deep links", () => {
  it("parses a complete link", () => {
    expect(
      parseRecordingDeepLink(
        "?recordingId=rec-1&segmentId=seg-1&segmentIndex=1&start=4",
      ),
    ).toEqual({
      recordingId: "rec-1",
      segmentId: "seg-1",
      segmentIndex: 1,
      start: 4,
    });
  });

  it("returns null without a recording id and ignores invalid optional values", () => {
    expect(parseRecordingDeepLink("")).toBeNull();
    expect(parseRecordingDeepLink("?recordingId=")).toBeNull();
    expect(
      parseRecordingDeepLink(
        "?recordingId=rec-1&segmentIndex=abc&start=-2&segmentId=",
      ),
    ).toEqual({
      recordingId: "rec-1",
      segmentId: null,
      segmentIndex: null,
      start: null,
    });
  });

  it("accepts URLSearchParams", () => {
    const params = new URLSearchParams({
      recordingId: "rec-2",
      segmentIndex: "0",
    });

    expect(parseRecordingDeepLink(params)).toEqual({
      recordingId: "rec-2",
      segmentId: null,
      segmentIndex: 0,
      start: null,
    });
  });

  it("matches by exact segment id before index and timing", () => {
    expect(
      findTranscriptSegment(segments, {
        segmentId: "seg-2",
        segmentIndex: 1,
        start: 4,
      }),
    ).toEqual(segments[2]);
  });

  it("falls back to segment index", () => {
    expect(
      findTranscriptSegment(segments, {
        segmentId: "missing",
        segmentIndex: 1,
      }),
    ).toEqual(segments[1]);
  });

  it("falls back to the nearest timestamp when available", () => {
    expect(findTranscriptSegment(segments, { start: 10.5 })).toEqual(
      segments[2],
    );
    expect(findTranscriptSegment(segments, { start: 5.1 })).toEqual(
      segments[1],
    );
  });

  it("returns null when nothing matches and no timing is available", () => {
    expect(
      findTranscriptSegment(segments, {
        segmentId: "missing",
        segmentIndex: 9,
      }),
    ).toBeNull();
  });

  it("does not duplicate a recording already in the list", () => {
    const first = recording("rec-a");
    const second = recording("rec-b");
    const items = [first, second];

    expect(mergeRecordings(items, recording("rec-a"))).toBe(items);
    expect(mergeRecordings(items, recording("rec-c")).map((item) => item.id)).toEqual([
      "rec-c",
      "rec-a",
      "rec-b",
    ]);
    expect(mergeRecordings(items, null)).toBe(items);
  });
});
