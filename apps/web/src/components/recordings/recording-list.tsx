import { useEffect, useRef, useState } from "react";
import {
  ACTIVE_RECORDING_STATUSES,
  RECORDING_STATUS_LABELS,
  type AnalysisEvidence,
  type RecordingDto,
} from "@callmind/shared";
import { AudioLines, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Progress } from "@/components/ui/progress";
import { AnalysisPanel } from "./analysis-panel";
import { RecordingStatusBadge } from "./status-badge";
import {
  findTranscriptSegment,
  type RecordingFocus,
} from "@/lib/recording-deep-link";
import {
  extensionLabel,
  formatDateTime,
  formatDuration,
  formatBytes,
} from "@/lib/format";

interface RecordingListProps {
  items: RecordingDto[];
  loading: boolean;
  error: string | null;
  retryingId: string | null;
  focus?: RecordingFocus | null;
  onRetry: (id: string) => void;
  onRefresh: () => void;
}

export function RecordingList({
  items,
  loading,
  error,
  retryingId,
  focus = null,
  onRetry,
  onRefresh,
}: RecordingListProps) {
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const [expandedRecordings, setExpandedRecordings] = useState<string[]>([]);
  const lastFocusRequest = useRef<string | null>(null);

  useEffect(() => {
    if (!focus || lastFocusRequest.current === focus.requestKey) {
      return;
    }

    const item = items.find(
      (candidate) => candidate.id === focus.recordingId,
    );
    if (!item) {
      return;
    }

    lastFocusRequest.current = focus.requestKey;
    setExpandedRecordings((previous) =>
      previous.includes(item.id) ? previous : [...previous, item.id],
    );

    const segment = findTranscriptSegment(
      item.transcript?.segments ?? [],
      focus,
    );
    if (!segment) {
      setActiveEvidence(null);
      return;
    }

    const segmentKey = segment.id ?? segment.index;
    setActiveEvidence(`${item.id}:${segmentKey}`);

    const timer = setTimeout(() => {
      document
        .getElementById(`transcript-segment-${item.id}-${segmentKey}`)
        ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }, 0);

    return () => clearTimeout(timer);
  }, [focus, items]);

  const toggleRecording = (id: string, open: boolean): void => {
    setExpandedRecordings((previous) => {
      if (open) {
        return previous.includes(id) ? previous : [...previous, id];
      }
      return previous.filter((candidate) => candidate !== id);
    });
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-14 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading recordings…
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Could not load recordings"
        description={error}
      >
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Try again
        </Button>
      </EmptyState>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No recordings yet"
        description="Upload an audio file above to start building your conversation history."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const isActive = ACTIVE_RECORDING_STATUSES.includes(item.status);
          const isRetrying = retryingId === item.id;
          const locateEvidence = (evidence: AnalysisEvidence): void => {
            const segment = findTranscriptSegment(
              item.transcript?.segments ?? [],
              evidence,
            );
            const segmentKey = segment
              ? (segment.id ?? segment.index)
              : (evidence.segmentId ?? evidence.segmentIndex ?? "0");
            setExpandedRecordings((previous) =>
              previous.includes(item.id) ? previous : [...previous, item.id],
            );
            setActiveEvidence(`${item.id}:${segmentKey}`);
            if (typeof document === "undefined") {
              return;
            }
            document
              .getElementById(`transcript-segment-${item.id}-${segmentKey}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          };

          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <AudioLines className="h-5 w-5" />
                </div>

                <div className="min-w-0 space-y-1.5">
                  <p className="truncate text-sm font-medium">
                    {item.originalFilename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(item.createdAt)} · {formatBytes(item.sizeBytes)} ·{" "}
                    {extensionLabel(item.extension)}
                    {item.durationSeconds !== null
                      ? ` · ${formatDuration(item.durationSeconds)}`
                      : ""}
                    {item.attempts > 0 ? ` · attempt ${item.attempts}` : ""}
                  </p>

                  {isActive ? (
                    <div className="w-full max-w-xs space-y-1">
                      <Progress
                        value={item.progress}
                        aria-label="Preparation progress"
                      />
                      <p className="text-xs text-muted-foreground">
                        {RECORDING_STATUS_LABELS[item.status]} · {item.progress}%
                      </p>
                    </div>
                  ) : null}

                  {item.transcript ? (
                    <div className="max-w-xl rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Transcript · {item.transcript.language} ·{" "}
                        {item.transcript.provider}
                      </p>
                      <p className="mt-1 max-h-24 overflow-hidden text-xs leading-relaxed whitespace-pre-wrap">
                        {item.transcript.text}
                      </p>
                      {item.transcript.segments.length ? (
                        <details
                          className="mt-2 text-xs"
                          open={expandedRecordings.includes(item.id)}
                          onToggle={(event) =>
                            toggleRecording(
                              item.id,
                              event.currentTarget.open,
                            )
                          }
                        >
                          <summary className="cursor-pointer text-muted-foreground">
                            Timed segments
                          </summary>
                          <ol className="mt-1 space-y-1">
                            {item.transcript.segments.map((segment) => {
                              const segmentKey = segment.id ?? segment.index;
                              const isActiveSegment =
                                activeEvidence === `${item.id}:${segmentKey}`;
                              return (
                                <li
                                  key={`${segment.id ?? segment.index}-${segment.index}`}
                                  id={`transcript-segment-${item.id}-${segmentKey}`}
                                  className={
                                    isActiveSegment
                                      ? "rounded bg-primary/10 px-2 py-1 text-primary"
                                      : "rounded px-2 py-1 text-muted-foreground"
                                  }
                                >
                                  <span className="font-mono text-[10px]">
                                    {formatDuration(segment.start)}–
                                    {formatDuration(segment.end)}
                                  </span>{" "}
                                  {segment.text}
                                </li>
                              );
                            })}
                          </ol>
                        </details>
                      ) : null}
                    </div>
                  ) : null}

                  <AnalysisPanel
                    analysis={item.analysis}
                    status={item.status}
                    error={item.error?.message ?? null}
                    onRetry={() => onRetry(item.id)}
                    retrying={isRetrying}
                    onLocateEvidence={locateEvidence}
                  />

                  {item.error ? (
                    <p className="text-xs leading-relaxed text-destructive">
                      {item.error.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                <RecordingStatusBadge status={item.status} />
                {item.status === "failed" || item.status === "analysis_failed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRetrying}
                    onClick={() => onRetry(item.id)}
                  >
                    {isRetrying ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Retry
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
