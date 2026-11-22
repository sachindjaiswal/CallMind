import type { RecordingTranscript } from "@callmind/db";
import {
  insightSchema,
  type ConsolidatedInsight,
  type ConversationInsight,
} from "@callmind/shared";
import { describe, expect, it } from "vitest";
import {
  ReportConsolidationError,
  consolidateRecordings,
  validateConsolidationResult,
  type ConsolidationSource,
} from "../lib/reportConsolidation";

function transcriptFor(
  recordingId: string,
  quotes: string[],
): RecordingTranscript {
  return {
    id: `tx-${recordingId}`,
    text: quotes.join(" "),
    language: "en",
    durationSeconds: quotes.length * 10,
    provider: "groq",
    model: "whisper-large-v3-turbo",
    processedAt: "2026-11-21T12:00:00.000Z",
    segments: quotes.map((quote, index) => ({
      id: `seg-${recordingId}-${index}`,
      index,
      start: index * 10,
      end: index * 10 + 5,
      text: quote,
      speakerId: null,
    })),
  };
}

function insightFor(
  recordingId: string,
  segmentIndex: number,
  quote: string,
  overrides: Partial<ConversationInsight>,
): ConversationInsight {
  return insightSchema.parse({
    category: "insight",
    explicitness: "explicit",
    confidence: "high",
    summary: quote,
    speakerId: null,
    evidence: {
      recordingId,
      segmentId: `seg-${recordingId}-${segmentIndex}`,
      segmentIndex,
      start: segmentIndex * 10,
      end: segmentIndex * 10 + 5,
      quote,
    },
    ...overrides,
  });
}

function sourceFor(
  recordingId: string,
  quotes: string[],
  insights: ConversationInsight[],
): ConsolidationSource {
  return {
    source: {
      recordingId,
      transcriptId: `tx-${recordingId}`,
      analysisId: `analysis-${recordingId}`,
      createdAt: "2026-11-21T12:00:00.000Z",
      analyzedAt: "2026-11-21T12:05:00.000Z",
    },
    analysis: {
      id: `analysis-${recordingId}`,
      summary: `Summary for ${recordingId}.`,
      insights,
    },
    transcript: transcriptFor(recordingId, quotes),
  };
}

describe("cross-recording consolidation", () => {
  it("groups repeated entities conservatively and keeps provenance", () => {
    const first = sourceFor(
      "aaaaaaaaaaaaaaaaaaaaaaaa",
      ["Pooja is on the team."],
      [
        insightFor("aaaaaaaaaaaaaaaaaaaaaaaa", 0, "Pooja is on the team.", {
          category: "person",
          summary: "Pooja is on the team.",
          name: "Pooja",
        }),
      ],
    );
    const second = sourceFor(
      "bbbbbbbbbbbbbbbbbbbbbbbb",
      ["Pooja joined the review."],
      [
        insightFor("bbbbbbbbbbbbbbbbbbbbbbbb", 0, "Pooja joined the review.", {
          category: "person",
          summary: "Pooja joined the review.",
          name: "Pooja",
        }),
      ],
    );

    const result = consolidateRecordings({
      reportDate: "2026-11-21",
      timezone: "UTC",
      sources: [first, second],
    });

    expect(result.consolidatedInsights).toHaveLength(1);
    expect(result.consolidatedInsights[0].sourceRecordingIds).toHaveLength(2);
    expect(result.consolidatedInsights[0].evidence).toHaveLength(2);
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].type).toBe("shared_entity");
    expect(result.relationships[0].explicitness).toBe("explicit");
    expect(result.conflicts).toHaveLength(0);
  });

  it("detects status, date and quantity conflicts without resolving them", () => {
    const firstId = "cccccccccccccccccccccccc";
    const secondId = "dddddddddddddddddddddddd";
    const firstQuotes = [
      "Send demo is draft.",
      "Send demo due Friday.",
      "Widget quantity ten.",
    ];
    const secondQuotes = [
      "Send demo is sent.",
      "Send demo due Monday.",
      "Widget quantity twenty.",
    ];

    const first = sourceFor(firstId, firstQuotes, [
      insightFor(firstId, 0, "Send demo is draft.", {
        category: "task",
        summary: "Send demo is draft.",
        description: "Send demo",
        status: "draft",
      }),
      insightFor(firstId, 1, "Send demo due Friday.", {
        category: "date",
        summary: "Send demo due Friday.",
        name: "Send demo",
        originalExpression: "Friday",
        normalizedDate: "2026-11-21",
      }),
      insightFor(firstId, 2, "Widget quantity ten.", {
        category: "transaction",
        summary: "Widget quantity ten.",
        productOrService: "Widget",
        quantity: 10,
      }),
    ]);
    const second = sourceFor(secondId, secondQuotes, [
      insightFor(secondId, 0, "Send demo is sent.", {
        category: "task",
        summary: "Send demo is sent.",
        description: "Send demo",
        status: "sent",
      }),
      insightFor(secondId, 1, "Send demo due Monday.", {
        category: "date",
        summary: "Send demo due Monday.",
        name: "Send demo",
        originalExpression: "Monday",
        normalizedDate: "2026-11-24",
      }),
      insightFor(secondId, 2, "Widget quantity twenty.", {
        category: "transaction",
        summary: "Widget quantity twenty.",
        productOrService: "Widget",
        quantity: 20,
      }),
    ]);

    const result = consolidateRecordings({
      reportDate: "2026-11-21",
      timezone: "UTC",
      sources: [first, second],
    });

    expect(new Set(result.conflicts.map((item) => item.type))).toEqual(
      new Set(["status_conflict", "date_conflict", "quantity_conflict"]),
    );
    expect(result.conflicts.every((item) => item.status === "unresolved")).toBe(true);
    expect(result.conflicts.every((item) => item.values.length === 2)).toBe(true);
    expect(new Set(result.relationships.map((item) => item.type))).toContain(
      "task_update",
    );
    expect(new Set(result.relationships.map((item) => item.type))).toContain(
      "deadline_revision",
    );
    expect(new Set(result.relationships.map((item) => item.type))).toContain(
      "value_revision",
    );
  });

  it("rejects fabricated evidence", () => {
    const source = sourceFor(
      "eeeeeeeeeeeeeeeeeeeeeeee",
      ["A precise source quote."],
      [
        insightFor("eeeeeeeeeeeeeeeeeeeeeeee", 0, "A precise source quote.", {
          summary: "A precise source quote.",
        }),
      ],
    );
    const result = consolidateRecordings({
      reportDate: "2026-11-21",
      timezone: "UTC",
      sources: [source],
    });
    const tampered = {
      ...result,
      consolidatedInsights: result.consolidatedInsights.map((insight) => ({
        ...insight,
        evidence: insight.evidence.map((evidence, index) =>
          index === 0 ? { ...evidence, quote: "A fabricated quote." } : evidence,
        ),
      })) as ConsolidatedInsight[],
    };

    expect(() => validateConsolidationResult(tampered, [source])).toThrowError(
      ReportConsolidationError,
    );
  });
});
