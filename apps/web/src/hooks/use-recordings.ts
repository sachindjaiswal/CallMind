import { ACTIVE_RECORDING_STATUSES, type RecordingDto } from "@callmind/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRecordings } from "@/lib/api";

export interface UseRecordingsResult {
  items: RecordingDto[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRecordings(
  pollMs = 3_000,
  limit = 50,
): UseRecordingsResult {
  const [items, setItems] = useState<RecordingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;

    try {
      const response = await fetchRecordings({ limit });
      setItems(response.items);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load recordings.",
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasActive = items.some((item) =>
    ACTIVE_RECORDING_STATUSES.includes(item.status),
  );

  useEffect(() => {
    if (!hasActive) {
      return;
    }

    const interval = setInterval(() => {
      void refresh();
    }, pollMs);

    return () => clearInterval(interval);
  }, [hasActive, pollMs, refresh]);

  return { items, loading, error, refresh };
}
