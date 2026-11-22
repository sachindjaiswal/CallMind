// @vitest-environment jsdom
import type { RecordingConfig, RecordingDto } from "@callmind/shared";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  fetchRecording,
  fetchRecordingConfig,
  fetchRecordings,
} from "@/lib/api";
import RecordingsPage from "./recordings";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchRecordingConfig: vi.fn(),
    fetchRecordings: vi.fn(),
    fetchRecording: vi.fn(),
    retryRecording: vi.fn(),
  };
});

const config: RecordingConfig = {
  maxFileSizeBytes: 25 * 1024 * 1024,
  maxFilesPerUpload: 5,
  supportedExtensions: ["wav", "mp3"],
  supportedLanguageHints: ["auto", "en"],
};

function recording(
  id: string,
  filename: string,
  withTranscript = true,
): RecordingDto {
  return {
    id,
    originalFilename: filename,
    mimeType: "audio/wav",
    extension: "wav",
    sizeBytes: 1024,
    checksum: `checksum-${id}`,
    status: "analysis_completed",
    languageHint: "auto",
    progress: 100,
    durationSeconds: 30,
    metadata: null,
    error: null,
    attempts: 1,
    transcriptionAttempts: 1,
    createdAt: "2026-11-21T12:00:00.000Z",
    updatedAt: "2026-11-21T12:00:00.000Z",
    transcript: withTranscript
      ? {
          id: `tx-${id}`,
          text: "First point. Second point.",
          language: "en",
          durationSeconds: 30,
          provider: "groq",
          model: "whisper-large-v3-turbo",
          processedAt: "2026-11-21T12:00:00.000Z",
          segments: [
            {
              id: `seg-${id}-0`,
              index: 0,
              start: 0,
              end: 4,
              text: "First point.",
              speakerId: null,
            },
            {
              id: `seg-${id}-1`,
              index: 1,
              start: 4,
              end: 9,
              text: "Second point.",
              speakerId: null,
            },
          ],
        }
      : null,
    analysis: null,
  } as RecordingDto;
}

function renderPage(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/recordings${search}`]}>
      <RecordingsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(fetchRecordingConfig).mockResolvedValue(config);
  vi.mocked(fetchRecordings).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  vi.mocked(fetchRecording).mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("recordings deep links", () => {
  it("fetches a recording missing from the list and focuses its segment", async () => {
    vi.mocked(fetchRecordings).mockResolvedValue({
      items: [recording("rec-a", "listed-a.wav")],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    vi.mocked(fetchRecording).mockResolvedValue(
      recording("rec-b", "linked-b.wav"),
    );

    const { container } = renderPage(
      "?recordingId=rec-b&segmentId=seg-rec-b-1&segmentIndex=1",
    );

    expect(await screen.findByText("linked-b.wav")).toBeTruthy();
    expect(fetchRecording).toHaveBeenCalledTimes(1);
    expect(fetchRecording).toHaveBeenCalledWith("rec-b");

    await waitFor(() => {
      const segment = container.querySelector(
        "#transcript-segment-rec-b-seg-rec-b-1",
      );
      expect(segment).not.toBeNull();
      expect(segment?.className).toContain("bg-primary/10");
      expect(segment?.closest("details")?.open).toBe(true);
    });
  });

  it("uses the segment index when the segment id does not match", async () => {
    vi.mocked(fetchRecording).mockResolvedValue(
      recording("rec-b", "linked-b.wav"),
    );

    const { container } = renderPage(
      "?recordingId=rec-b&segmentId=missing&segmentIndex=1",
    );

    expect(await screen.findByText("linked-b.wav")).toBeTruthy();

    await waitFor(() => {
      expect(
        container.querySelector("#transcript-segment-rec-b-seg-rec-b-1")
          ?.className,
      ).toContain("bg-primary/10");
    });
  });

  it("does not duplicate a recording already present in the list", async () => {
    vi.mocked(fetchRecordings).mockResolvedValue({
      items: [recording("rec-a", "listed-a.wav")],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    renderPage("?recordingId=rec-a&segmentId=seg-rec-a-0");

    expect(await screen.findByText("listed-a.wav")).toBeTruthy();
    expect(screen.getAllByText("listed-a.wav")).toHaveLength(1);
    expect(fetchRecording).not.toHaveBeenCalled();
  });

  it("shows an unavailable-source message when the recording cannot be fetched", async () => {
    vi.mocked(fetchRecording).mockRejectedValue(
      new ApiRequestError(404, "RECORDING_NOT_FOUND", "Recording not found."),
    );

    renderPage("?recordingId=missing-recording");

    expect(
      await screen.findByText("Source recording unavailable"),
    ).toBeTruthy();
    expect(screen.getByText(/Recording not found/)).toBeTruthy();
  });

  it("ignores invalid query parameters without fetching", async () => {
    renderPage("?recordingId=&segmentIndex=abc");

    await waitFor(() => {
      expect(fetchRecordings).toHaveBeenCalled();
    });

    expect(fetchRecording).not.toHaveBeenCalled();
    expect(screen.queryByText("Source recording unavailable")).toBeNull();
  });
});
