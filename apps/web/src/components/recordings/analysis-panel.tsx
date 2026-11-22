import type {
  AnalysisDto,
  AnalysisEvidence,
  ConversationInsight,
  InsightCategory,
  RecordingStatus,
} from "@callmind/shared";
import { INSIGHT_CATEGORIES } from "@callmind/shared";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/insight-categories";

export interface InsightGroup {
  category: InsightCategory;
  label: string;
  insights: ConversationInsight[];
}

export function groupInsightsByCategory(
  insights: ConversationInsight[],
): InsightGroup[] {
  return INSIGHT_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    insights: insights.filter((insight) => insight.category === category),
  })).filter((group) => group.insights.length > 0);
}

interface AnalysisPanelProps {
  analysis: AnalysisDto | null;
  status: RecordingStatus;
  error?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  onLocateEvidence?: (evidence: AnalysisEvidence) => void;
}

function insightFields(insight: ConversationInsight): Array<[string, string]> {
  const entries: Array<[string, string | number | null | string[] | undefined]> = [
    ["Name", insight.name],
    ["Role", insight.role],
    ["Contact", insight.contactInfo],
    ["Assigned by", insight.assignedBy],
    ["Assigned to", insight.assignedTo],
    ["Direction", insight.taskDirection],
    ["Original expression", insight.originalExpression],
    ["Normalized date", insight.normalizedDate],
    ["Reference date", insight.referenceDate],
    ["Made by", insight.madeBy],
    ["Amount", insight.amount === null ? null : `${insight.currency ?? ""} ${insight.amount}`.trim()],
    ["Product or service", insight.productOrService],
    ["Milestone", insight.milestone],
    ["Severity", insight.severity],
    ["Question", insight.question],
    ["Asked by", insight.askedBy],
    ["Participants", insight.participants],
    ["People", insight.relatedPeople],
    ["Projects", insight.relatedProjects],
  ];

  return entries.flatMap(([label, value]) => {
    if (value === null || value === undefined || value === "") {
      return [];
    }
    if (Array.isArray(value)) {
      return value.length ? [[label, value.join(", ")]] : [];
    }
    return [[label, String(value)]];
  });
}

function EvidenceButton({
  evidence,
  onLocateEvidence,
}: {
  evidence: AnalysisEvidence;
  onLocateEvidence?: (evidence: AnalysisEvidence) => void;
}) {
  return (
    <button
      type="button"
      className="mt-2 max-w-full truncate rounded border border-border px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      onClick={() => onLocateEvidence?.(evidence)}
      title="Show this evidence in the transcript"
    >
      <span className="font-medium">Evidence</span> ·{" "}
      {formatDuration(evidence.start)}–{formatDuration(evidence.end)} · “
      {evidence.quote}”
    </button>
  );
}

export function AnalysisPanel({
  analysis,
  status,
  error,
  onRetry,
  retrying = false,
  onLocateEvidence,
}: AnalysisPanelProps) {
  if ((status === "analysis_queued" || status === "analyzing") && !analysis) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        AI analysis in progress…
      </div>
    );
  }

  if (status === "analysis_failed" && !analysis) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <p>{error ?? "Conversation analysis failed."}</p>
        {onRetry ? (
          <button
            type="button"
            className="mt-1 font-medium underline underline-offset-2 disabled:opacity-60"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? "Retrying…" : "Retry analysis"}
          </button>
        ) : null}
      </div>
    );
  }

  if (!analysis || analysis.status !== "completed") {
    return null;
  }

  const groups = groupInsightsByCategory(analysis.insights);

  return (
    <section className="max-w-2xl rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Conversation intelligence
        </p>
        <Badge variant="outline" className="text-[10px]">
          {analysis.model}
        </Badge>
        {analysis.fallbackUsed ? (
          <Badge variant="warning" className="text-[10px]">
            Fallback model
          </Badge>
        ) : null}
      </div>

      <p className="mt-1 text-xs leading-relaxed">{analysis.summary}</p>

      {analysis.topics.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {analysis.topics.map((topic) => (
            <Badge key={topic} variant="secondary" className="text-[10px]">
              {topic}
            </Badge>
          ))}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No structured insights were found in this conversation.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {groups.map((group) => (
            <div key={group.category}>
              <p className="text-[11px] font-semibold text-foreground/80">
                {group.label}
              </p>
              <ul className="mt-1 space-y-1">
                {group.insights.map((insight, index) => (
                  <li
                    key={`${group.category}-${index}`}
                    className="rounded border border-border/60 bg-background/40 px-2 py-1.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={
                          insight.explicitness === "explicit"
                            ? "success"
                            : "warning"
                        }
                        className="text-[10px]"
                      >
                        {insight.explicitness}
                      </Badge>
                      {insight.confidence ? (
                        <Badge variant="outline" className="text-[10px]">
                          {insight.confidence} confidence
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed">
                      {insight.summary}
                    </p>
                    {insight.description ? (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {insight.description}
                      </p>
                    ) : null}
                    {insightFields(insight).length ? (
                      <dl className="mt-1 grid grid-cols-1 gap-0.5 text-[11px] text-muted-foreground sm:grid-cols-2">
                        {insightFields(insight).map(([label, value]) => (
                          <div key={label}>
                            <dt className="inline font-medium">{label}: </dt>
                            <dd className="inline">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    <EvidenceButton
                      evidence={insight.evidence}
                      onLocateEvidence={onLocateEvidence}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
