import type {
  AnalysisDto,
  ConsolidatedInsight,
  ConversationInsight,
  DailyReportDto,
  DailyReportSourceRecording,
  RecordingDto,
  ReportEvidence,
} from "@callmind/shared";
import {
  AlertTriangle,
  CalendarDays,
  Gavel,
  Handshake,
  ListChecks,
  MessageSquare,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { categoryLabel } from "@/lib/insight-categories";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/format";
import {
  inferContactFromFilename,
  type InferredContact,
} from "@/lib/contact-inference";

export interface RecordingInsightView {
  id: string;
  category: string;
  summary: string;
  explicitness: "explicit" | "inferred";
  confidence: "low" | "medium" | "high" | null;
  details: Array<{ label: string; value: string }>;
  evidence: ReportEvidence[];
}

export interface RecordingSection {
  key: string;
  label: string;
  icon: LucideIcon;
  items: RecordingInsightView[];
}

export const RECORDING_SECTIONS: ReadonlyArray<{
  key: string;
  label: string;
  categories: readonly string[];
  icon: LucideIcon;
}> = [
  {
    key: "discussion",
    label: "Discussion points",
    categories: ["topic", "insight"],
    icon: MessageSquare,
  },
  {
    key: "people",
    label: "People and organizations",
    categories: ["person", "project"],
    icon: Users,
  },
  {
    key: "tasks",
    label: "Tasks and responsibilities",
    categories: ["task"],
    icon: ListChecks,
  },
  {
    key: "commitments",
    label: "Commitments",
    categories: ["commitment"],
    icon: Handshake,
  },
  {
    key: "decisions",
    label: "Decisions and agreements",
    categories: ["decision"],
    icon: Gavel,
  },
  {
    key: "values",
    label: "Dates, quantities, and prices",
    categories: ["date", "transaction"],
    icon: CalendarDays,
  },
  {
    key: "risks",
    label: "Risks, concerns, and questions",
    categories: ["risk", "question"],
    icon: AlertTriangle,
  },
];

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function humanizeValue(value: string): string {
  const spaced = value.replaceAll("_", " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function amountText(insight: ConversationInsight): string | null {
  if (insight.amount === null) {
    return null;
  }
  const amount = String(insight.amount);
  return insight.currency ? `${insight.currency} ${amount}` : amount;
}

function addDetail(
  pairs: Array<{ label: string; value: string }>,
  summary: string,
  label: string,
  value: string | number | string[] | null | undefined,
): void {
  if (value === null || value === undefined) {
    return;
  }

  const text = Array.isArray(value)
    ? value.join(", ")
    : typeof value === "number"
      ? String(value)
      : value.trim();

  if (!text || normalized(text) === normalized(summary)) {
    return;
  }

  if (pairs.some((pair) => pair.label === label && pair.value === text)) {
    return;
  }

  pairs.push({ label, value: text });
}

export function insightDetailPairs(insight: ConversationInsight): Array<{
  label: string;
  value: string;
}> {
  const pairs: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: string | number | string[] | null | undefined): void =>
    addDetail(pairs, insight.summary, label, value);

  switch (insight.category) {
    case "person":
      add("Name", insight.name);
      add("Role", insight.role);
      add("Contact", insight.contactInfo);
      add("Description", insight.description);
      break;
    case "project":
      add("Name", insight.name);
      add("Description", insight.description);
      add("Status", insight.status);
      add("Milestone", insight.milestone);
      break;
    case "task":
      add("Assigned by", insight.assignedBy);
      add("Assigned to", insight.assignedTo);
      add("Direction", insight.taskDirection ? humanizeValue(insight.taskDirection) : null);
      add("Due date", insight.dueDate);
      add("Status", insight.status);
      add("Description", insight.description);
      break;
    case "commitment":
      add("Made by", insight.madeBy);
      add("Due date", insight.dueDate);
      add("Status", insight.status);
      add("Description", insight.description);
      break;
    case "decision":
      add("Made by", insight.madeBy);
      add("Status", insight.status);
      add("Description", insight.description);
      break;
    case "date":
      add("Original expression", insight.originalExpression);
      add("Normalized date", insight.normalizedDate);
      add("Date type", insight.dateType);
      add("Reference date", insight.referenceDate);
      add("Description", insight.description);
      break;
    case "transaction":
      add("Product or service", insight.productOrService);
      add("Quantity", insight.quantity);
      add("Amount", amountText(insight));
      add("Payment status", insight.paymentStatus);
      add("Delivery status", insight.deliveryStatus);
      add("Status", insight.status);
      add("Description", insight.description);
      break;
    case "risk":
      add("Severity", insight.severity);
      add("Concerns", insight.concerns);
      add("Status", insight.status);
      add("Description", insight.description);
      break;
    case "question":
      add("Question", insight.question);
      add("Asked by", insight.askedBy);
      add("Status", insight.status);
      add("Description", insight.description);
      break;
    default:
      add("Description", insight.description);
      break;
  }

  add("Participants", insight.participants);
  add("Related people", insight.relatedPeople);
  add("Related projects", insight.relatedProjects);

  return pairs;
}

export function analysisInsightViews(
  analysis: AnalysisDto | null,
  recordingId: string,
): RecordingInsightView[] {
  if (!analysis || analysis.status !== "completed") {
    return [];
  }

  return analysis.insights.map((insight, index) => {
    const insightId = `${analysis.id}:insight:${index}`;
    return {
      id: insightId,
      category: insight.category,
      summary: insight.summary,
      explicitness: insight.explicitness,
      confidence: insight.confidence,
      details: insightDetailPairs(insight),
      evidence: [
        {
          insightId,
          analysisId: analysis.id,
          recordingId: insight.evidence.recordingId,
          segmentId: insight.evidence.segmentId,
          segmentIndex: insight.evidence.segmentIndex,
          start: insight.evidence.start,
          end: insight.evidence.end,
          quote: insight.evidence.quote,
        },
      ].filter((item) => item.recordingId === recordingId),
    };
  });
}

export function reportInsightViews(
  insights: ConsolidatedInsight[],
  recordingId: string,
): RecordingInsightView[] {
  return insights
    .filter((insight) => insight.sourceRecordingIds.includes(recordingId))
    .map((insight) => ({
      id: insight.id,
      category: insight.category,
      summary: insight.summary,
      explicitness: insight.explicitness,
      confidence: insight.confidence,
      details: [],
      evidence: insight.evidence.filter(
        (item) => item.recordingId === recordingId,
      ),
    }));
}

export function recordingInsightViews(
  recording: RecordingDto | null,
  report: DailyReportDto,
  recordingId: string,
): { views: RecordingInsightView[]; source: "analysis" | "report" } {
  const analysisViews = analysisInsightViews(recording?.analysis ?? null, recordingId);
  if (analysisViews.length > 0) {
    return { views: analysisViews, source: "analysis" };
  }
  return {
    views: reportInsightViews(report.consolidatedInsights, recordingId),
    source: "report",
  };
}

export function callSummaryBullets(analysis: AnalysisDto | null): string[] {
  const summary = analysis?.summary?.trim();
  if (!summary) {
    return [];
  }

  return summary
    .split(/\n+/)
    .flatMap((line) =>
      line
        .replace(/^[-*•]\s*/, "")
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim()),
    )
    .filter(Boolean);
}

export function groupRecordingInsights(
  views: RecordingInsightView[],
): RecordingSection[] {
  const sections = RECORDING_SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    icon: section.icon,
    items: views.filter((view) => section.categories.includes(view.category)),
  })).filter((section) => section.items.length > 0);

  const known = new Set(RECORDING_SECTIONS.flatMap((section) => section.categories));
  const other = views.filter((view) => !known.has(view.category));
  if (other.length > 0) {
    sections.push({
      key: "other",
      label: "Other details",
      icon: Sparkles,
      items: other,
    });
  }

  return sections;
}

export function recordingDisplayName(
  recording: RecordingDto | null,
  recordingId: string,
): string {
  const filename = recording?.originalFilename?.trim();
  return filename || `Recording ${recordingId.slice(-6)}`;
}

export function recordingContactInference(
  recording: RecordingDto | null,
): InferredContact | null {
  const filename = recording?.originalFilename;
  if (!filename?.trim()) {
    return null;
  }

  const inference = inferContactFromFilename(filename);
  return inference.name ? inference : null;
}

export function recordingMetadata(
  recording: RecordingDto | null,
  source: DailyReportSourceRecording,
): Array<{ label: string; value: string }> {
  const detectedLanguage = recording?.transcript?.language?.trim();
  const languageHint = recording?.languageHint?.trim();
  const languageItem = detectedLanguage
    ? { label: "Language", value: detectedLanguage }
    : { label: "Language hint", value: languageHint || null };

  const items: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Created", value: formatDateTime(source.createdAt) },
    { label: "Analyzed", value: formatDateTime(source.analyzedAt) },
    {
      label: "Duration",
      value:
        recording?.durationSeconds === null || recording?.durationSeconds === undefined
          ? null
          : formatDuration(recording.durationSeconds),
    },
    languageItem,
    {
      label: "Size",
      value: recording ? formatBytes(recording.sizeBytes) : null,
    },
    { label: "Model", value: recording?.analysis?.model },
  ];

  return items.flatMap((item) =>
    item.value ? [{ label: item.label, value: item.value }] : [],
  );
}

export { categoryLabel };
