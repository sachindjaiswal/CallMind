import type {
  DailyReportConflict,
  DailyReportConflictDecision,
  DailyReportDto,
  ReportEvidence,
} from "@callmind/shared";
import { AlertTriangle, ArrowLeftRight, FileText, RefreshCw } from "lucide-react";
import { useState } from "react";
import { EvidenceDrawer } from "@/components/daily-reports/evidence-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

interface ReportDetailProps {
  report: DailyReportDto;
  onRegenerate: (report: DailyReportDto) => void;
  onConflictDecision: (
    conflictId: string,
    decision: DailyReportConflictDecision,
  ) => Promise<void>;
}

function statusVariant(status: DailyReportDto["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "destructive" as const;
  return "warning" as const;
}

function confidenceVariant(confidence: "low" | "medium" | "high") {
  if (confidence === "high") return "success" as const;
  if (confidence === "medium") return "warning" as const;
  return "outline" as const;
}

export function ReportDetail({
  report,
  onRegenerate,
  onConflictDecision,
}: ReportDetailProps) {
  const [evidence, setEvidence] = useState<ReportEvidence[] | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const review = async (conflict: DailyReportConflict, status: "resolved" | "dismissed") => {
    setReviewingId(conflict.id);
    setReviewError(null);
    try {
      await onConflictDecision(conflict.id, {
        status,
        reviewerNote: status === "resolved" ? "Resolved in the UI." : null,
      });
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Could not update conflict.");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Daily report · {report.reportDate}</CardTitle>
              <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
              <Badge variant="outline">{report.timezone}</Badge>
            </div>
            <CardDescription>
              {report.selectedRecordingIds.length} selected recording
              {report.selectedRecordingIds.length === 1 ? "" : "s"} · generated{" "}
              {report.generatedAt ? formatDateTime(report.generatedAt) : "pending"}
              {report.previousReportId ? ` · regeneration of ${report.previousReportId}` : ""}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRegenerate(report)}
          >
            <RefreshCw />
            Regenerate
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.overallSummary ? (
            <p className="text-sm leading-relaxed">{report.overallSummary}</p>
          ) : null}
          {report.status === "queued" || report.status === "generating" ? (
            <p className="text-xs text-muted-foreground">
              Generation is in progress. This view refreshes automatically.
            </p>
          ) : null}
          {report.error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <p className="font-medium">{report.error.code}</p>
              <p>{report.error.message}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline">{report.provider}</Badge>
            <Badge variant="outline">{report.model}</Badge>
            <Badge variant="outline">{report.schemaVersion}</Badge>
            <Badge variant="outline">{report.attempts} attempts</Badge>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            Consolidated insights ({report.consolidatedInsights.length})
          </h2>
        </div>
        {report.consolidatedInsights.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No insights are available yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {report.consolidatedInsights.map((insight) => (
              <Card key={insight.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{insight.category}</Badge>
                    <Badge variant={confidenceVariant(insight.confidence)}>
                      {insight.confidence}
                    </Badge>
                    <Badge variant="outline">{insight.explicitness}</Badge>
                  </div>
                  <CardTitle className="pt-2 text-sm">{insight.summary}</CardTitle>
                  <CardDescription>
                    {insight.sourceRecordingIds.length} source recording
                    {insight.sourceRecordingIds.length === 1 ? "" : "s"} ·{" "}
                    {insight.evidence.length} evidence item
                    {insight.evidence.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEvidence(insight.evidence)}
                  >
                    View evidence
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            Proposed relationships ({report.relationships.length})
          </h2>
        </div>
        {report.relationships.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No relationship was proposed. Insights remain separate unless evidence supports a link.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {report.relationships.map((relationship) => (
              <Card key={relationship.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{relationship.type}</Badge>
                    <Badge variant="outline">{relationship.explicitness}</Badge>
                    <Badge variant={confidenceVariant(relationship.confidence)}>
                      {relationship.confidence}
                    </Badge>
                    <Badge variant="secondary">{relationship.reviewStatus}</Badge>
                  </div>
                  <p className="text-sm font-medium">{relationship.summary}</p>
                  <p className="text-xs text-muted-foreground">{relationship.explanation}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEvidence(relationship.evidence)}
                  >
                    View evidence
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            Conflicts ({report.conflicts.length})
          </h2>
        </div>
        {reviewError ? <p className="text-xs text-destructive">{reviewError}</p> : null}
        {report.conflicts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No unresolved conflict was detected in the selected recordings.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {report.conflicts.map((conflict) => (
              <Card key={conflict.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="warning">{conflict.type}</Badge>
                    <Badge
                      variant={
                        conflict.status === "unresolved"
                          ? "warning"
                          : conflict.status === "resolved"
                            ? "success"
                            : "secondary"
                      }
                    >
                      {conflict.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{conflict.summary}</p>
                  <p className="text-xs text-muted-foreground">{conflict.explanation}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {conflict.values.map((value, index) => (
                      <div key={`${value.insightId}-${index}`} className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">
                          Recording {value.recordingId.slice(-6)}
                        </p>
                        <p className="mt-1 text-sm font-medium">{value.value}</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0"
                          onClick={() => setEvidence([value.evidence])}
                        >
                          View evidence
                        </Button>
                      </div>
                    ))}
                  </div>
                  {conflict.reviewerNote ? (
                    <p className="text-xs text-muted-foreground">Note: {conflict.reviewerNote}</p>
                  ) : null}
                  {conflict.status === "unresolved" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={reviewingId === conflict.id}
                        onClick={() => void review(conflict, "resolved")}
                      >
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reviewingId === conflict.id}
                        onClick={() => void review(conflict, "dismissed")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {evidence ? (
        <EvidenceDrawer evidence={evidence} onClose={() => setEvidence(null)} />
      ) : null}
    </div>
  );
}
