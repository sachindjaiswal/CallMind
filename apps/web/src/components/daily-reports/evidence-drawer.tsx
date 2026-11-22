import type { ReportEvidence } from "@callmind/shared";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";
import { ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EvidenceDrawerProps {
  evidence: ReportEvidence[];
  onClose: () => void;
  onOpenSourceRecording?: (evidence: ReportEvidence) => void;
}

function evidenceKey(item: ReportEvidence): string {
  return [
    item.recordingId,
    item.segmentId ?? "",
    item.segmentIndex ?? "",
    item.start,
    item.end,
    item.quote,
  ].join("|");
}

/**
 * Removes repeated excerpts so the same quote from the same segment is not
 * listed multiple times when several insights share it.
 */
export function dedupeEvidence(evidence: ReportEvidence[]): ReportEvidence[] {
  const seen = new Set<string>();
  const unique: ReportEvidence[] = [];

  for (const item of evidence) {
    const key = evidenceKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function hasRecordingId(item: ReportEvidence): boolean {
  return typeof item.recordingId === "string" && item.recordingId.trim() !== "";
}

export function EvidenceDrawer({
  evidence,
  onClose,
  onOpenSourceRecording,
}: EvidenceDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const uniqueEvidence = useMemo(() => dedupeEvidence(evidence), [evidence]);

  useEffect(() => {
    const previouslyFocused =
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    closeButtonRef.current?.focus();

    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleBackdropMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handlePanelKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void => {
    if (event.key !== "Tab") {
      return;
    }

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onMouseDown={handleBackdropMouseDown}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handlePanelKeyDown}
        className="flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              Evidence
            </h2>
            <p className="text-xs text-muted-foreground">
              {uniqueEvidence.length} linked transcript excerpt
              {uniqueEvidence.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close evidence"
          >
            <X />
          </Button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {uniqueEvidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No evidence is linked to this item.
            </p>
          ) : null}
          {uniqueEvidence.map((item, index) => (
            <div
              key={`${item.insightId}-${index}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge
                  variant="secondary"
                  title={item.recordingId}
                >
                  Recording {item.recordingId.slice(-6)}
                </Badge>
                <Badge variant="outline">
                  Segment {item.segmentIndex ?? "—"}
                </Badge>
                <Badge variant="outline">
                  {item.start.toFixed(2)}s – {item.end.toFixed(2)}s
                </Badge>
              </div>
              <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-foreground">
                “{item.quote}”
              </blockquote>
              {onOpenSourceRecording && hasRecordingId(item) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => onOpenSourceRecording(item)}
                >
                  <ExternalLink />
                  Open source recording
                </Button>
              ) : null}
              <p className="mt-3 break-all text-[11px] text-muted-foreground">
                Insight {item.insightId} · Analysis {item.analysisId}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
