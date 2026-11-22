import {
  consolidatedInsightSchema,
  dailyReportConflictSchema,
  dailyReportRelationshipSchema,
  reportEvidenceSchema,
  type ConsolidatedInsight,
  type ConversationInsight,
  type DailyReportConflict,
  type DailyReportConsolidation,
  type DailyReportRelationship,
  type ReportConflictValue,
  type ReportEvidence,
  type ValidatedReportSource,
} from "@callmind/shared";
import type { RecordingTranscript } from "@callmind/db";
import { createHash } from "node:crypto";
import { z } from "zod";

export class ReportConsolidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ReportConsolidationError";
    this.code = code;
  }
}

export interface ConsolidationAnalysis {
  id: string;
  summary: string;
  insights: ConversationInsight[];
}

export interface ConsolidationSource {
  source: ValidatedReportSource;
  analysis: ConsolidationAnalysis;
  transcript: RecordingTranscript;
}

export interface ConsolidationInput {
  reportDate: string;
  timezone: string;
  sources: ConsolidationSource[];
}

interface FlatInsight {
  id: string;
  analysisId: string;
  recordingId: string;
  insight: ConversationInsight;
  evidence: ReportEvidence;
  subjectKey: string;
  entityKey: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stableId(prefix: string, parts: string[]): string {
  const digest = createHash("sha1")
    .update(parts.join("\u0000"))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${digest}`;
}

function sourceInsightId(analysisId: string, index: number): string {
  return `${analysisId}:insight:${index}`;
}

function withoutNumbers(value: string): string {
  return value.replace(/\d+(?:[.,]\d+)?/g, " ").replace(/\s+/g, " ").trim();
}

function subjectOf(insight: ConversationInsight): string {
  const candidates = [
    insight.name,
    insight.productOrService,
    insight.description,
    insight.question,
    insight.summary,
  ];
  return candidates.find((value) => value && value.trim()) ?? insight.summary;
}

function subjectKeyOf(insight: ConversationInsight): string {
  const key = normalize(withoutNumbers(subjectOf(insight)));
  return key.length >= 3 ? key : "";
}

function entityKeyOf(insight: ConversationInsight): string {
  switch (insight.category) {
    case "person":
      return insight.name ? `person:${normalize(insight.name)}` : "";
    case "project":
      return insight.name ? `project:${normalize(insight.name)}` : "";
    case "transaction":
      return insight.productOrService
        ? `transaction:${normalize(insight.productOrService)}`
        : "";
    case "task":
    case "commitment":
      return insight.description
        ? `task:${normalize(insight.description)}`
        : `task:${normalize(insight.summary)}`;
    case "date":
      return insight.name
        ? `date:${normalize(insight.name)}`
        : `date:${normalize(insight.originalExpression ?? insight.summary)}`;
    default:
      return `${insight.category}:${normalize(insight.summary)}`;
  }
}

function confidenceFrom(values: string[]): "low" | "medium" | "high" {
  if (values.length > 0 && values.every((value) => value === "high")) {
    return "high";
  }
  return values.some((value) => value === "low") ? "low" : "medium";
}

function explicitnessFrom(values: string[]): "explicit" | "inferred" {
  return values.every((value) => value === "explicit") ? "explicit" : "inferred";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function evidenceFor(
  insight: ConversationInsight,
  analysisId: string,
  insightId: string,
): ReportEvidence {
  const candidate = reportEvidenceSchema.safeParse({
    insightId,
    analysisId,
    recordingId: insight.evidence.recordingId,
    segmentId: insight.evidence.segmentId,
    segmentIndex: insight.evidence.segmentIndex,
    start: insight.evidence.start,
    end: insight.evidence.end,
    quote: insight.evidence.quote,
  });

  if (!candidate.success) {
    throw new ReportConsolidationError(
      "REPORT_EVIDENCE_INVALID",
      "Stored analysis evidence could not be used in a daily report.",
    );
  }

  return candidate.data;
}

function flattenSources(sources: ConsolidationSource[]): FlatInsight[] {
  return sources.flatMap(({ source, analysis }) =>
    analysis.insights.map((insight, index) => {
      const id = sourceInsightId(analysis.id, index);
      return {
        id,
        analysisId: analysis.id,
        recordingId: source.recordingId,
        insight,
        evidence: evidenceFor(insight, analysis.id, id),
        subjectKey: subjectKeyOf(insight),
        entityKey: entityKeyOf(insight),
      };
    }),
  );
}

function buildSummary(input: ConsolidationInput): string {
  const count = input.sources.length;
  const parts = input.sources.map(
    ({ source, analysis }, index) =>
      `Recording ${index + 1} (${source.recordingId}): ${analysis.summary}`,
  );
  return `Consolidated ${count} selected recording${count === 1 ? "" : "s"} for ${input.reportDate} in ${input.timezone}. ${parts.join(" ")}`.trim();
}

function buildInsights(flat: FlatInsight[]): ConsolidatedInsight[] {
  const groups = new Map<string, FlatInsight[]>();

  for (const item of flat) {
    const key = `${item.insight.category}:${item.entityKey || normalize(item.insight.summary)}`;
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  return [...groups.values()].map((items) => {
    const first = items[0];
    const result = {
      id: stableId("insight", items.map((item) => item.id)),
      category: first.insight.category,
      summary: first.insight.summary,
      explicitness: explicitnessFrom(items.map((item) => item.insight.explicitness)),
      confidence: confidenceFrom(
        items
          .map((item) => item.insight.confidence)
          .filter((value): value is "low" | "medium" | "high" => value !== null),
      ),
      sourceInsightIds: unique(items.map((item) => item.id)),
      sourceRecordingIds: unique(items.map((item) => item.recordingId)),
      evidence: items.map((item) => item.evidence),
    };
    return consolidatedInsightSchema.parse(result);
  });
}

function dateValue(insight: ConversationInsight): string | null {
  return insight.normalizedDate ?? insight.dueDate ?? insight.originalExpression;
}

function conflictValue(
  item: FlatInsight,
  value: string,
): ReportConflictValue {
  return {
    value,
    insightId: item.id,
    recordingId: item.recordingId,
    evidence: item.evidence,
  };
}

function buildConflictsAndRelationships(flat: FlatInsight[]): {
  conflicts: DailyReportConflict[];
  relationships: DailyReportRelationship[];
} {
  const conflicts: DailyReportConflict[] = [];
  const relationships: DailyReportRelationship[] = [];
  const relationshipKeys = new Set<string>();

  const addRelationship = (
    type: DailyReportRelationship["type"],
    items: FlatInsight[],
    summary: string,
    explanation: string,
  ): void => {
    const insightIds = unique(items.map((item) => item.id));
    const key = `${type}:${[...insightIds].sort().join(",")}`;
    if (relationshipKeys.has(key)) {
      return;
    }
    relationshipKeys.add(key);

    relationships.push(
      dailyReportRelationshipSchema.parse({
        id: stableId("relationship", [type, ...insightIds]),
        type,
        summary,
        explanation,
        explicitness: explicitnessFrom(items.map((item) => item.insight.explicitness)),
        confidence: confidenceFrom(
          items
            .map((item) => item.insight.confidence)
            .filter((value): value is "low" | "medium" | "high" => value !== null),
        ),
        sourceInsightIds: insightIds,
        sourceRecordingIds: unique(items.map((item) => item.recordingId)),
        evidence: items.map((item) => item.evidence),
        reviewStatus: "pending",
      }),
    );
  };

  for (let firstIndex = 0; firstIndex < flat.length; firstIndex += 1) {
    const first = flat[firstIndex];

    for (let secondIndex = firstIndex + 1; secondIndex < flat.length; secondIndex += 1) {
      const second = flat[secondIndex];
      if (first.recordingId === second.recordingId) {
        continue;
      }

      const canRelate =
        (first.subjectKey !== "" && first.subjectKey === second.subjectKey) ||
        (first.entityKey !== "" && first.entityKey === second.entityKey);

      if (canRelate) {
        addRelationship(
          first.insight.category === "person" || first.insight.category === "project"
            ? "shared_entity"
            : "shared_topic",
          [first, second],
          `${subjectOf(first.insight)} appears in multiple recordings`,
          "The same normalized subject was explicitly present in more than one selected recording. The connection is proposed, not confirmed.",
        );
      }

      if (!canRelate || first.subjectKey === "") {
        continue;
      }

      const statusA = first.insight.status;
      const statusB = second.insight.status;
      if (
        statusA &&
        statusB &&
        normalize(statusA) !== normalize(statusB) &&
        ["task", "commitment", "transaction"].includes(first.insight.category) &&
        first.insight.category === second.insight.category
      ) {
        conflicts.push(
          dailyReportConflictSchema.parse({
            id: stableId("conflict", ["status", first.subjectKey, first.id, second.id]),
            type: "status_conflict",
            summary: `Status differs for ${subjectOf(first.insight)}`,
            explanation: "Selected recordings report different status values for the same subject.",
            explicitness: explicitnessFrom([
              first.insight.explicitness,
              second.insight.explicitness,
            ]),
            confidence: confidenceFrom(
              [first.insight.confidence, second.insight.confidence].filter(
                (value): value is "low" | "medium" | "high" => value !== null,
              ),
            ),
            sourceInsightIds: [first.id, second.id],
            sourceRecordingIds: unique([first.recordingId, second.recordingId]),
            values: [
              conflictValue(first, statusA),
              conflictValue(second, statusB),
            ],
            status: "unresolved",
            reviewerNote: null,
            reviewedAt: null,
          }),
        );
        addRelationship(
          "task_update",
          [first, second],
          `Status update for ${subjectOf(first.insight)}`,
          "Different status values were found for the same subject across recordings.",
        );
      }

      const dateA = dateValue(first.insight);
      const dateB = dateValue(second.insight);
      if (
        first.insight.category === "date" &&
        second.insight.category === "date" &&
        dateA &&
        dateB &&
        normalize(dateA) !== normalize(dateB)
      ) {
        conflicts.push(
          dailyReportConflictSchema.parse({
            id: stableId("conflict", ["date", first.subjectKey, first.id, second.id]),
            type: "date_conflict",
            summary: `Date differs for ${subjectOf(first.insight)}`,
            explanation: "Selected recordings report different date values for the same subject.",
            explicitness: explicitnessFrom([
              first.insight.explicitness,
              second.insight.explicitness,
            ]),
            confidence: confidenceFrom(
              [first.insight.confidence, second.insight.confidence].filter(
                (value): value is "low" | "medium" | "high" => value !== null,
              ),
            ),
            sourceInsightIds: [first.id, second.id],
            sourceRecordingIds: unique([first.recordingId, second.recordingId]),
            values: [
              conflictValue(first, dateA),
              conflictValue(second, dateB),
            ],
            status: "unresolved",
            reviewerNote: null,
            reviewedAt: null,
          }),
        );
        addRelationship(
          "deadline_revision",
          [first, second],
          `Date revision for ${subjectOf(first.insight)}`,
          "Different date values were found for the same subject across recordings.",
        );
      }

      const quantityA = first.insight.quantity;
      const quantityB = second.insight.quantity;
      if (
        first.insight.category === "transaction" &&
        second.insight.category === "transaction" &&
        quantityA !== null &&
        quantityB !== null &&
        quantityA !== quantityB
      ) {
        conflicts.push(
          dailyReportConflictSchema.parse({
            id: stableId("conflict", ["quantity", first.subjectKey, first.id, second.id]),
            type: "quantity_conflict",
            summary: `Quantity differs for ${subjectOf(first.insight)}`,
            explanation: "Selected recordings report different quantities for the same subject.",
            explicitness: explicitnessFrom([
              first.insight.explicitness,
              second.insight.explicitness,
            ]),
            confidence: confidenceFrom(
              [first.insight.confidence, second.insight.confidence].filter(
                (value): value is "low" | "medium" | "high" => value !== null,
              ),
            ),
            sourceInsightIds: [first.id, second.id],
            sourceRecordingIds: unique([first.recordingId, second.recordingId]),
            values: [
              conflictValue(first, String(quantityA)),
              conflictValue(second, String(quantityB)),
            ],
            status: "unresolved",
            reviewerNote: null,
            reviewedAt: null,
          }),
        );
        addRelationship(
          "value_revision",
          [first, second],
          `Quantity revision for ${subjectOf(first.insight)}`,
          "Different quantity values were found for the same subject across recordings.",
        );
      }
    }
  }

  return { conflicts, relationships };
}

function validateEvidenceAgainstTranscript(
  evidence: ReportEvidence,
  recordingId: string,
  transcript: RecordingTranscript,
): void {
  if (evidence.recordingId !== recordingId) {
    throw new ReportConsolidationError(
      "REPORT_RECORDING_MISMATCH",
      "Report evidence references a different recording.",
    );
  }

  let segment = evidence.segmentId
    ? transcript.segments.find((item) => item.id === evidence.segmentId)
    : undefined;

  if (evidence.segmentIndex !== null) {
    const indexed = transcript.segments.find(
      (item) => item.index === evidence.segmentIndex,
    );
    if (!indexed) {
      throw new ReportConsolidationError(
        "REPORT_SEGMENT_MISSING",
        "Report evidence references a missing transcript segment.",
      );
    }
    if (segment && segment !== indexed) {
      throw new ReportConsolidationError(
        "REPORT_SEGMENT_CONFLICT",
        "Report evidence segment id and index do not match.",
      );
    }
    segment = segment ?? indexed;
  }

  if (!segment) {
    throw new ReportConsolidationError(
      "REPORT_SEGMENT_MISSING",
      "Report evidence does not reference a transcript segment.",
    );
  }

  if (
    evidence.end < evidence.start ||
    Math.abs(segment.start - evidence.start) > 0.25 ||
    Math.abs(segment.end - evidence.end) > 0.25
  ) {
    throw new ReportConsolidationError(
      "REPORT_TIMING_MISMATCH",
      "Report evidence timing does not match the transcript segment.",
    );
  }

  const quote = normalize(evidence.quote);
  const source = normalize(segment.text);
  if (!quote || !source.includes(quote)) {
    throw new ReportConsolidationError(
      "REPORT_QUOTE_MISMATCH",
      "Report evidence quote is not present in the transcript segment.",
    );
  }
}

export function validateConsolidationResult(
  value: DailyReportConsolidation,
  sources: ConsolidationSource[],
): DailyReportConsolidation {
  const sourcesByRecordingId = new Map(
    sources.map((source) => [source.source.recordingId, source]),
  );
  const insightIds = new Set(
    sources.flatMap(({ analysis }) =>
      analysis.insights.map((_, index) => sourceInsightId(analysis.id, index)),
    ),
  );

  const checkEvidence = (evidence: ReportEvidence): void => {
    const source = sourcesByRecordingId.get(evidence.recordingId);
    if (!source) {
      throw new ReportConsolidationError(
        "REPORT_SOURCE_UNKNOWN",
        "Report evidence references a recording outside the selected set.",
      );
    }
    if (!insightIds.has(evidence.insightId)) {
      throw new ReportConsolidationError(
        "REPORT_INSIGHT_UNKNOWN",
        "Report evidence references an unknown source insight.",
      );
    }
    validateEvidenceAgainstTranscript(
      evidence,
      source.source.recordingId,
      source.transcript,
    );
  };

  for (const insight of value.consolidatedInsights) {
    for (const insightId of insight.sourceInsightIds) {
      if (!insightIds.has(insightId)) {
        throw new ReportConsolidationError(
          "REPORT_INSIGHT_UNKNOWN",
          "Consolidated insight references an unknown source insight.",
        );
      }
    }
    insight.evidence.forEach(checkEvidence);
  }

  for (const relationship of value.relationships) {
    relationship.sourceInsightIds.forEach((insightId) => {
      if (!insightIds.has(insightId)) {
        throw new ReportConsolidationError(
          "REPORT_INSIGHT_UNKNOWN",
          "Relationship references an unknown source insight.",
        );
      }
    });
    relationship.evidence.forEach(checkEvidence);
  }

  for (const conflict of value.conflicts) {
    conflict.sourceInsightIds.forEach((insightId) => {
      if (!insightIds.has(insightId)) {
        throw new ReportConsolidationError(
          "REPORT_INSIGHT_UNKNOWN",
          "Conflict references an unknown source insight.",
        );
      }
    });
    conflict.values.forEach((item) => checkEvidence(item.evidence));
  }

  return value;
}

export function consolidateRecordings(
  input: ConsolidationInput,
): DailyReportConsolidation {
  if (input.sources.length === 0) {
    throw new ReportConsolidationError(
      "REPORT_NO_SOURCES",
      "At least one completed source recording is required.",
    );
  }

  const flat = flattenSources(input.sources);
  const { conflicts, relationships } = buildConflictsAndRelationships(flat);
  const result: DailyReportConsolidation = {
    overallSummary: buildSummary(input),
    sourceRecordings: input.sources.map((item) => ({ ...item.source })),
    sourceAnalysisIds: input.sources.map((item) => item.analysis.id),
    consolidatedInsights: buildInsights(flat),
    relationships,
    conflicts,
  };

  z
    .object({
      overallSummary: z.string(),
      sourceRecordings: z.array(z.object({ recordingId: z.string() })),
      sourceAnalysisIds: z.array(z.string()),
      consolidatedInsights: z.array(consolidatedInsightSchema),
      relationships: z.array(dailyReportRelationshipSchema),
      conflicts: z.array(dailyReportConflictSchema),
    })
    .parse(result);

  return validateConsolidationResult(result, input.sources);
}
