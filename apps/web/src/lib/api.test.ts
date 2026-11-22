import type { RecordingDto } from "@callmind/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, fetchRecording } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRecording", () => {
  it("calls the existing recording endpoint and parses the DTO", async () => {
    const dto = { id: "rec-1", originalFilename: "call.wav" } as RecordingDto;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(dto), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRecording("rec-1")).resolves.toEqual(dto);
    expect(fetchMock).toHaveBeenCalledWith("/api/recordings/rec-1", {
      headers: { Accept: "application/json" },
    });
  });

  it("surfaces API errors consistently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "RECORDING_NOT_FOUND", message: "Recording not found." },
          }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(fetchRecording("missing")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 404,
      code: "RECORDING_NOT_FOUND",
      message: "Recording not found.",
    });

    await expect(fetchRecording("missing")).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});
