import type { RecordingDto } from "@callmind/shared";
import { useEffect, useRef, useState } from "react";
import { fetchRecording } from "@/lib/api";

export function useRecordingDetails(recordingIds: string[]): {
  details: Record<string, RecordingDto>;
  loading: boolean;
  error: string | null;
} {
  const idsKey = recordingIds.join("\u0000");
  const requestIdRef = useRef(0);
  const [details, setDetails] = useState<Record<string, RecordingDto>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = idsKey ? idsKey.split("\u0000") : [];

    if (ids.length === 0) {
      setDetails({});
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setDetails({});
    setLoading(true);
    setError(null);

    void Promise.allSettled(ids.map((id) => fetchRecording(id))).then(
      (results) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        const next: Record<string, RecordingDto> = {};
        let failures = 0;
        results.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value?.id) {
            next[ids[index]] = result.value;
          } else {
            failures += 1;
          }
        });

        setDetails(next);
        setError(
          failures > 0
            ? "Some recording details could not be loaded. Showing report data where available."
            : null,
        );
        setLoading(false);
      },
    );
  }, [idsKey]);

  return { details, loading, error };
}
