import type {
  DailyReportDto,
  DailyReportSourceRecording,
  RecordingDto,
  ReportEvidence,
} from "@callmind/shared";
import { FileAudio, Info, Loader2 } from "lucide-react";
import { useId, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  callSummaryBullets,
  categoryLabel,
  groupRecordingInsights,
  recordingContactInference,
  recordingDisplayName,
  recordingInsightViews,
  recordingMetadata,
} from "@/lib/recording-dashboard";

function statusVariant(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "destructive" as const;
  return "warning" as const;
}

function confidenceVariant(confidence: "low" | "medium" | "high") {
  if (confidence === "high") return "success" as const;
  if (confidence === "medium") return "warning" as const;
  return "outline" as const;
}

export function RecordingCard({
  source,
  recording,
  report,
  loading,
  onViewEvidence,
}: {
  source: DailyReportSourceRecording;
  recording: RecordingDto | null;
  report: DailyReportDto;
  loading: boolean;
  onViewEvidence: (evidence: ReportEvidence[]) => void;
}) {
  const headingId = useId();
  const { views, source: detailSource } = useMemo(
    () => recordingInsightViews(recording, report, source.recordingId),
    [recording, report, source.recordingId],
  );
  const sections = useMemo(() => groupRecordingInsights(views), [views]);
  const summaryBullets = useMemo(
    () => callSummaryBullets(recording?.analysis ?? null),
    [recording],
  );
  const metadata = useMemo(
    () => recordingMetadata(recording, source),
    [recording, source],
  );
  const evidence = useMemo(
    () => views.flatMap((view) => view.evidence),
    [views],
  );
  const topics = recording?.analysis?.topics ?? [];
  const title = recordingDisplayName(recording, source.recordingId);
  const inferredContact = useMemo(
    () => recordingContactInference(recording),
    [recording],
  );
  const analysisStatus = recording?.analysis?.status;

  return (
    <Card data-testid="recording-card" aria-labelledby={headingId}>
      <CardHeader className="space-y-3 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" />
              <CardTitle id={headingId} className="break-words" title={title}>
                {title}
              </CardTitle>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Recording {source.recordingId.slice(-6)} · Analysis{" "}
              {source.analysisId.slice(-6)}
            </p>
            {inferredContact?.name ? (
              <Badge
                variant="secondary"
                className="text-[10px]"
                title="Inferred from the recording filename; not speaker identification"
              >
                <span className="font-medium">Likely contact (from filename)</span>
                <span className="ml-1">{inferredContact.name}</span>
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {analysisStatus ? (
              <Badge variant={statusVariant(analysisStatus)}>
                {analysisStatus}
              </Badge>
            ) : null}
            {recording?.analysis?.model ? (
              <Badge variant="outline">{recording.analysis.model}</Badge>
            ) : null}
            {loading ? (
              <Badge variant="outline">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Loading details
              </Badge>
            ) : null}
          </div>
        </div>

        {metadata.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {metadata.map((item) => (
              <span key={item.label}>
                <span className="font-medium">{item.label}:</span> {item.value}
              </span>
            ))}
          </div>
        ) : null}

        {topics.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {topics.map((topic) => (
              <Badge key={topic} variant="secondary" className="text-[10px]">
                {topic}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {detailSource === "report" ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Full per-recording analysis is unavailable. Showing consolidated
            report insights for this recording.
          </p>
        ) : null}

        <section className="space-y-2" aria-label="Call summary">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Call summary</h3>
          </div>
          {summaryBullets.length > 0 ? (
            <ul className="ml-5 list-disc space-y-1 text-sm leading-relaxed">
              {summaryBullets.map((bullet, index) => (
                <li key={`${index}-${bullet.slice(0, 24)}`}>{bullet}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading call summary…"
                : "No written call summary is available for this recording."}
            </p>
          )}
        </section>

        {sections.length > 0 ? (
          sections.map((section) => (
            <section
              key={section.key}
              className="space-y-2"
              aria-label={section.label}
            >
              <div className="flex items-center gap-2">
                <section.icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{section.label}</h3>
                <span className="text-xs text-muted-foreground">
                  {section.items.length}
                </span>
              </div>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-border bg-muted/20 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {categoryLabel(item.category)}
                      </Badge>
                      <Badge
                        variant={
                          item.explicitness === "explicit" ? "success" : "warning"
                        }
                        className="text-[10px]"
                      >
                        {item.explicitness}
                      </Badge>
                      {item.confidence ? (
                        <Badge
                          variant={confidenceVariant(item.confidence)}
                          className="text-[10px]"
                        >
                          {item.confidence} confidence
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed">
                      {item.summary}
                    </p>
                    {item.details.length > 0 ? (
                      <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                        {item.details.map((detail) => (
                          <div key={`${detail.label}-${detail.value}`}>
                            <dt className="inline font-medium">
                              {detail.label}:{" "}
                            </dt>
                            <dd className="inline">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading recording details…"
              : "No structured insights are available for this recording."}
          </p>
        )}

        {evidence.length > 0 ? (
          <div className="flex justify-end border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewEvidence(evidence)}
            >
              View evidence ({evidence.length})
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
