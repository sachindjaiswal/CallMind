import type { RecordingDto, TranscriptSegmentDto } from "@callmind/shared";

export interface RecordingDeepLink {
  recordingId: string;
  segmentId: string | null;
  segmentIndex: number | null;
  start: number | null;
}

export interface RecordingFocus extends RecordingDeepLink {
  requestKey: string;
}

export interface SegmentFocusTarget {
  segmentId?: string | null;
  segmentIndex?: number | null;
  start?: number | null;
}

const RECORDING_ID_PARAM = "recordingId";
const SEGMENT_ID_PARAM = "segmentId";
const SEGMENT_INDEX_PARAM = "segmentIndex";
const START_PARAM = "start";

function optionalText(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Parses `/recordings?recordingId=...&segmentId=...&segmentIndex=...`.
 * Returns null when no usable recording id is present. Invalid optional
 * parameters are ignored rather than failing the whole link.
 */
export function parseRecordingDeepLink(
  search: string | URLSearchParams,
): RecordingDeepLink | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const recordingId = params.get(RECORDING_ID_PARAM)?.trim();

  if (!recordingId) {
    return null;
  }

  const rawSegmentIndex = params.get(SEGMENT_INDEX_PARAM);
  const parsedSegmentIndex =
    rawSegmentIndex === null ? Number.NaN : Number(rawSegmentIndex);
  const segmentIndex =
    Number.isInteger(parsedSegmentIndex) && parsedSegmentIndex >= 0
      ? parsedSegmentIndex
      : null;

  const rawStart = params.get(START_PARAM);
  const parsedStart =
    rawStart === null || rawStart.trim() === ""
      ? Number.NaN
      : Number(rawStart);
  const start =
    Number.isFinite(parsedStart) && parsedStart >= 0 ? parsedStart : null;

  return {
    recordingId,
    segmentId: optionalText(params.get(SEGMENT_ID_PARAM)),
    segmentIndex,
    start,
  };
}

/**
 * Resolves the transcript segment a deep link should focus, using:
 * 1. exact segment id,
 * 2. exact segment index,
 * 3. nearest segment start time when timing information is available.
 */
export function findTranscriptSegment(
  segments: TranscriptSegmentDto[],
  target: SegmentFocusTarget,
): TranscriptSegmentDto | null {
  if (target.segmentId) {
    const byId = segments.find((segment) => segment.id === target.segmentId);
    if (byId) {
      return byId;
    }
  }

  if (
    typeof target.segmentIndex === "number" &&
    Number.isInteger(target.segmentIndex) &&
    target.segmentIndex >= 0
  ) {
    const byIndex = segments.find(
      (segment) => segment.index === target.segmentIndex,
    );
    if (byIndex) {
      return byIndex;
    }
  }

  if (
    typeof target.start === "number" &&
    Number.isFinite(target.start) &&
    segments.length > 0
  ) {
    let nearest = segments[0];
    let nearestDistance = Math.abs(nearest.start - target.start);

    for (const segment of segments.slice(1)) {
      const distance = Math.abs(segment.start - target.start);
      if (distance < nearestDistance) {
        nearest = segment;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  return null;
}

/**
 * Adds a fetched recording to the visible list while keeping the current
 * list entry when the recording is already present.
 */
export function mergeRecordings(
  items: RecordingDto[],
  extra: RecordingDto | null,
): RecordingDto[] {
  if (!extra || items.some((item) => item.id === extra.id)) {
    return items;
  }

  return [extra, ...items];
}
