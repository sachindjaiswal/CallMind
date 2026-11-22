import {
  ANALYSIS_PROMPT_VERSION,
  ANALYSIS_SCHEMA_VERSION,
  analysisEvidenceSchema,
  conversationAnalysisSchema,
  geminiAnalysisResponseSchema,
  type AnalysisEvidence,
  type AnalysisProvider,
  type ConversationAnalysis,
  type ConversationInsight,
  type TranscriptDto,
} from "@callmind/shared";
import {
  GeminiAnalysisError,
  generateGeminiStructuredResponse,
  type GeminiAdapterConfig,
} from "./geminiAnalysis";

export class AnalysisValidationError extends Error {
  readonly code: string;

  constructor(message: string, code = "ANALYSIS_EVIDENCE_INVALID") {
    super(message);
    this.name = "AnalysisValidationError";
    this.code = code;
  }
}

export interface ConversationAnalysisResult {
  provider: AnalysisProvider;
  model: string;
  fallbackUsed: boolean;
  attemptedModels: string[];
  schemaVersion: string;
  promptVersion: string;
  summary: string;
  topics: string[];
  insights: ConversationInsight[];
}

const INSIGHT_CONTENT_FIELDS: Record<
  ConversationInsight["category"],
  ReadonlyArray<keyof ConversationInsight>
> = {
  topic: ["name", "description", "participants"],
  person: ["name", "role", "contactInfo", "description"],
  task: [
    "description",
    "assignedBy",
    "assignedTo",
    "deadlineOriginal",
    "dueDate",
    "quantity",
    "quantityUnit",
    "deliveryDestination",
    "deliveryDate",
    "deliveryTime",
    "packagingRequirements",
  ],
  date: ["originalExpression", "description", "dueDate", "deliveryDate", "deliveryTime"],
  decision: ["description", "madeBy"],
  commitment: ["description", "madeBy", "assignedTo"],
  transaction: [
    "productOrService",
    "amount",
    "description",
    "quantity",
    "quantityUnit",
    "deliveryDestination",
    "deliveryDate",
    "deliveryTime",
    "packagingRequirements",
    "deliveryStatus",
  ],
  project: ["name", "description", "milestone"],
  risk: ["description", "concerns", "severity"],
  question: ["question", "description", "askedBy"],
  insight: ["description", "summary"],
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasContent(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return typeof value === "number" && Number.isFinite(value);
}

function validateEvidence(
  evidence: AnalysisEvidence,
  recordingId: string,
  transcript: TranscriptDto,
): AnalysisEvidence {
  if (evidence.recordingId !== recordingId) {
    throw new AnalysisValidationError(
      "Evidence references a different recording.",
      "ANALYSIS_RECORDING_MISMATCH",
    );
  }

  const parsed = analysisEvidenceSchema.parse(evidence);
  const segments = transcript.segments;
  let segment = parsed.segmentId
    ? segments.find((item) => item.id === parsed.segmentId)
    : undefined;

  if (parsed.segmentIndex !== null) {
    const indexed = segments.find((item) => item.index === parsed.segmentIndex);
    if (!indexed) {
      throw new AnalysisValidationError(
        "Evidence references a missing transcript segment.",
      );
    }
    if (segment && segment !== indexed) {
      throw new AnalysisValidationError(
        "Evidence segment id and index do not match.",
      );
    }
    segment = segment ?? indexed;
  }

  if (!segment) {
    throw new AnalysisValidationError(
      "Evidence does not reference a transcript segment.",
    );
  }

  if (
    parsed.end < parsed.start ||
    Math.abs(segment.start - parsed.start) > 0.25 ||
    Math.abs(segment.end - parsed.end) > 0.25
  ) {
    throw new AnalysisValidationError(
      "Evidence timing does not match the referenced transcript segment.",
    );
  }

  const quote = normalizeWhitespace(parsed.quote);
  const source = normalizeWhitespace(segment.text);
  if (!quote || !source.includes(quote)) {
    throw new AnalysisValidationError(
      "Evidence quote is not present in the referenced transcript segment.",
    );
  }

  return {
    ...parsed,
    segmentId: segment.id ?? parsed.segmentId ?? null,
    segmentIndex: segment.index,
    start: segment.start,
    end: segment.end,
  };
}

export function validateAnalysisAgainstTranscript(
  value: unknown,
  recordingId: string,
  transcript: TranscriptDto,
): ConversationAnalysis {
  const parsed = conversationAnalysisSchema.parse(value);
  const insights = parsed.insights.flatMap((insight) => {
    let normalizedDate = insight.normalizedDate;
    let referenceDate = insight.referenceDate;
    if (insight.category === "date" && !insight.originalExpression) {
      throw new AnalysisValidationError(
        "A date insight must preserve the original expression.",
        "ANALYSIS_DATE_EXPRESSION_REQUIRED",
      );
    }

    const contentFields = INSIGHT_CONTENT_FIELDS[insight.category];
    if (!contentFields.some((field) => hasContent(insight[field]))) {
      return [];
    }

    const evidence = validateEvidence(
      insight.evidence,
      recordingId,
      transcript,
    );

    if (
      insight.category === "date" &&
      (!normalizedDate || !referenceDate)
    ) {
      normalizedDate = null;
      referenceDate = null;
    }

    return {
      ...insight,
      speakerId: null,
      evidence,
      normalizedDate,
      referenceDate,
    };
  });

  if (!parsed.summary && parsed.topics.length === 0 && insights.length === 0) {
    throw new AnalysisValidationError(
      "Analysis contains no content.",
      "ANALYSIS_EMPTY_RESPONSE",
    );
  }

  return { ...parsed, insights };
}

export function buildConversationAnalysisPrompt(
  recordingId: string,
  transcript: TranscriptDto,
): string {
  const segments = transcript.segments
    .map(
      (segment) =>
        `- index=${segment.index} id=${segment.id ?? "unknown"} start=${segment.start} end=${segment.end} speaker=${segment.speakerId ?? "unknown"}: ${segment.text}`,
    )
    .join("\n");

  return [
    `Analyse the conversation for recording ${recordingId} and return grounded conversation intelligence as JSON.`,
    `Transcript id: ${transcript.id ?? "unknown"}. Language: ${transcript.language}. Duration seconds: ${transcript.durationSeconds}.`,
    "Transcript segments:",
    segments || "(no segments)",
    "",
    "Rules:",
    "- Return only JSON matching the provided response schema.",
    "- Use only this transcript. Do not import context from other recordings or prior conversations.",
    "- Use only information present in the transcript. Do not invent facts, deadlines, amounts, names, or ownership.",
    "- Support every insight with one exact quote from a transcript segment and the matching segment id/index/start/end.",
    "- Do not assume the uploader is a speaker, participant, assigner, assignee, owner, or client.",
    "- Keep speakerId null because speakers are not identified. Do not infer speaker identity.",
    "- Set explicitness to 'explicit' only when the transcript states it directly; otherwise use 'inferred' with lower confidence.",
    "- Confidence is a qualitative hint, not a statistical probability. Do not raise confidence to make a weak extraction seem factual.",
    "- Preserve original date and time expressions exactly. Normalize only when a clear reference date is available and record that reference date; otherwise leave normalization null.",
    "- For tasks, preserve direction only when explicit; otherwise use 'unknown'.",
    "- Use the most specific applicable category and fill its structured fields when the transcript supports them; do not use 'insight' merely because a detail is unusual.",
    "- Check for named people and organisations, locations, dates and times, quantities and units, requested actions, deliverables and requirements, commitments, status changes, risks, and questions. Emit a separate insight for each distinct supported item.",
    "- For orders, deliveries, and similar transactions, populate productOrService, quantity, quantityUnit, deliveryDestination, deliveryDate, deliveryTime, and packagingRequirements when they are stated.",
    "- Write a factual one-to-three sentence summary covering the main topic, key entities, requested actions, and the most important supported dates, times, quantities, and outcomes. Do not replace it with a single repeated phrase.",
    "- Do not turn a possibility, request, or suggestion into a decision or commitment.",
    "- Do not create duplicate insights that restate the same fact, and do not create empty insights only to populate the schema.",
    "- Return an empty insights array when nothing meaningful is present.",
    "- Prefer multiple focused insights over one broad insight.",
    `- Set schemaVersion to ${ANALYSIS_SCHEMA_VERSION} and promptVersion to ${ANALYSIS_PROMPT_VERSION} in your reasoning context; they are stored by the application.`,
  ].join("\n");
}

export interface AnalyzeConversationInput {
  recordingId: string;
  transcript: TranscriptDto;
  adapterConfig: GeminiAdapterConfig;
}

export async function analyzeConversationWithGemini({
  recordingId,
  transcript,
  adapterConfig,
}: AnalyzeConversationInput): Promise<ConversationAnalysisResult> {
  let result;
  try {
    result = await generateGeminiStructuredResponse<ConversationAnalysis>(
      {
        prompt: buildConversationAnalysisPrompt(recordingId, transcript),
        responseSchema: geminiAnalysisResponseSchema as Record<string, unknown>,
        parse: (value) => conversationAnalysisSchema.parse(value),
      },
      adapterConfig,
    );
  } catch (error) {
    if (error instanceof GeminiAnalysisError) {
      throw error;
    }
    throw new GeminiAnalysisError({
      message:
        error instanceof Error ? error.message : "Gemini analysis failed.",
      code: "GEMINI_ANALYSIS_FAILED",
      retryable: false,
    });
  }

  const analysis = validateAnalysisAgainstTranscript(
    result.data,
    recordingId,
    transcript,
  );

  return {
    provider: "gemini",
    model: result.model,
    fallbackUsed: result.fallbackUsed,
    attemptedModels: result.attemptedModels,
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    promptVersion: ANALYSIS_PROMPT_VERSION,
    summary: analysis.summary,
    topics: analysis.topics,
    insights: analysis.insights,
  };
}
