import type { TranscriptDto } from "@callmind/shared";
import { describe, expect, it } from "vitest";
import {
  AnalysisValidationError,
  buildConversationAnalysisPrompt,
  validateAnalysisAgainstTranscript,
} from "../lib/conversationAnalysis";

const RECORDING_ID = "64b7f9c2e1b2a4d5f6a7b8c9";

const TRANSCRIPT: TranscriptDto = {
  id: `tx-${RECORDING_ID}`,
  text: "Let us review the roadmap on Friday. We should ask Maya about the API.",
  language: "en",
  durationSeconds: 8,
  provider: "groq",
  model: "whisper-large-v3-turbo",
  processedAt: "2026-11-21T12:00:00.000Z",
  segments: [
    {
      id: `seg-${RECORDING_ID}-0`,
      index: 0,
      start: 0,
      end: 4,
      text: "Let us review the roadmap on Friday.",
      speakerId: null,
    },
    {
      id: `seg-${RECORDING_ID}-1`,
      index: 1,
      start: 4,
      end: 8,
      text: "We should ask Maya about the API.",
      speakerId: null,
    },
  ],
};

const DELIVERY_RECORDING_ID = "64b7f9c2e1b2a4d5f6a7b8ca";

const DELIVERY_TRANSCRIPT: TranscriptDto = {
  id: `tx-${DELIVERY_RECORDING_ID}`,
  text: "Okay so there needs to be an order delivered to Shweta enterprises at 13th of December. The quantity of order should be around 200 units and it should be packed in a proper box. The delivery time should be around 3 p.m.",
  language: "en",
  durationSeconds: 10,
  provider: "groq",
  model: "whisper-large-v3-turbo",
  processedAt: "2026-11-21T12:00:00.000Z",
  segments: [
    {
      id: `seg-${DELIVERY_RECORDING_ID}-0`,
      index: 0,
      start: 0,
      end: 4,
      text: "okay so there needs to be an order delivered to Shweta enterprises at 13th of December",
      speakerId: null,
    },
    {
      id: `seg-${DELIVERY_RECORDING_ID}-1`,
      index: 1,
      start: 4,
      end: 8,
      text: "the quantity of order should be around 200 units and it should be packed in a proper box",
      speakerId: null,
    },
    {
      id: `seg-${DELIVERY_RECORDING_ID}-2`,
      index: 2,
      start: 8,
      end: 10,
      text: "the delivery time should be around 3 p.m.",
      speakerId: null,
    },
  ],
};

function evidence(index: 0 | 1, quote: string) {
  const segment = TRANSCRIPT.segments[index];
  return {
    recordingId: RECORDING_ID,
    segmentId: segment.id,
    segmentIndex: segment.index,
    start: segment.start,
    end: segment.end,
    quote,
  };
}

function deliveryEvidence(index: 0 | 1 | 2, quote: string) {
  const segment = DELIVERY_TRANSCRIPT.segments[index];
  return {
    recordingId: DELIVERY_RECORDING_ID,
    segmentId: segment.id,
    segmentIndex: segment.index,
    start: segment.start,
    end: segment.end,
    quote,
  };
}

function baseAnalysis(insights: unknown[]): unknown {
  return {
    summary: "Planning follow-up work.",
    topics: ["roadmap"],
    insights,
  };
}

describe("conversation analysis validation", () => {
  it("validates explicit and inferred insights without inventing speakers", () => {
    const result = validateAnalysisAgainstTranscript(
      baseAnalysis([
        {
          category: "task",
          explicitness: "explicit",
          confidence: "high",
          summary: "Review the roadmap on Friday.",
          speakerId: "uploader",
          evidence: evidence(0, "review the roadmap on Friday"),
          assignedTo: "the team",
          taskDirection: "between_participants",
          deadlineOriginal: "Friday",
        },
        {
          category: "person",
          explicitness: "inferred",
          confidence: "low",
          summary: "Maya may be relevant to the API discussion.",
          speakerId: "speaker-1",
          evidence: evidence(1, "ask Maya about the API"),
          name: "Maya",
        },
        {
          category: "date",
          explicitness: "explicit",
          summary: "Friday was mentioned.",
          speakerId: null,
          evidence: evidence(0, "Friday"),
          originalExpression: "Friday",
          normalizedDate: "2026-11-27",
          referenceDate: null,
        },
      ]),
      RECORDING_ID,
      TRANSCRIPT,
    );

    expect(result.insights).toHaveLength(3);
    expect(result.insights.every((insight) => insight.speakerId === null)).toBe(
      true,
    );
    expect(result.insights[2]).toMatchObject({
      originalExpression: "Friday",
      normalizedDate: null,
      referenceDate: null,
    });
  });

  it("rejects evidence quotes that are not in the transcript", () => {
    expect(() =>
      validateAnalysisAgainstTranscript(
        baseAnalysis([
          {
            category: "insight",
            explicitness: "explicit",
            summary: "The team agreed to launch.",
            speakerId: null,
            evidence: evidence(0, "agreed to launch"),
          },
        ]),
        RECORDING_ID,
        TRANSCRIPT,
      ),
    ).toThrowError(AnalysisValidationError);
  });

  it("drops insights without category-specific content while retaining valid ones", () => {
    const result = validateAnalysisAgainstTranscript(
      baseAnalysis([
        {
          category: "decision",
          explicitness: "explicit",
          summary: "A decision was made.",
          speakerId: null,
          evidence: evidence(0, "review the roadmap"),
        },
        {
          category: "insight",
          explicitness: "explicit",
          summary: "The roadmap was mentioned.",
          description: "Review the roadmap on Friday.",
          speakerId: null,
          evidence: evidence(0, "review the roadmap on Friday"),
        },
      ]),
      RECORDING_ID,
      TRANSCRIPT,
    );

    expect(result.insights).toHaveLength(1);
    expect(result.insights[0]).toMatchObject({
      category: "insight",
      description: "Review the roadmap on Friday.",
    });
  });

  it("rejects date insights that do not preserve the original expression", () => {
    expect(() =>
      validateAnalysisAgainstTranscript(
        baseAnalysis([
          {
            category: "date",
            explicitness: "explicit",
            summary: "Friday was mentioned.",
            speakerId: null,
            evidence: evidence(0, "Friday"),
          },
        ]),
        RECORDING_ID,
        TRANSCRIPT,
      ),
    ).toThrow(/original expression/i);
  });

  it("captures supported delivery details as distinct structured insights", () => {
    const result = validateAnalysisAgainstTranscript(
      {
        summary:
          "An order for Shweta enterprises should be delivered around 13th of December at 3 p.m. The order is for about 200 units and should be packed in a proper box.",
        topics: ["delivery order"],
        insights: [
          {
            category: "transaction",
            explicitness: "explicit",
            confidence: "high",
            summary: "Order quantity is around 200 units and needs proper box packing.",
            description: "Order quantity and packaging requirement.",
            productOrService: "order",
            quantity: 200,
            quantityUnit: "units",
            packagingRequirements: "proper box",
            speakerId: null,
            evidence: deliveryEvidence(
              1,
              "around 200 units and it should be packed in a proper box",
            ),
          },
          {
            category: "transaction",
            explicitness: "explicit",
            confidence: "high",
            summary: "The order should be delivered to Shweta enterprises.",
            description: "Requested delivery destination.",
            productOrService: "order",
            deliveryDestination: "Shweta enterprises",
            speakerId: null,
            evidence: deliveryEvidence(
              0,
              "delivered to Shweta enterprises at 13th of December",
            ),
          },
          {
            category: "date",
            explicitness: "explicit",
            confidence: "high",
            summary: "Requested delivery date is 13th of December.",
            originalExpression: "13th of December",
            description: "Delivery date requested in the conversation.",
            speakerId: null,
            evidence: deliveryEvidence(0, "13th of December"),
          },
          {
            category: "insight",
            explicitness: "explicit",
            confidence: "high",
            summary: "Requested delivery time is around 3 p.m.",
            description: "Delivery time requested in the conversation.",
            deliveryTime: "around 3 p.m.",
            speakerId: null,
            evidence: deliveryEvidence(2, "around 3 p.m."),
          },
        ],
      },
      DELIVERY_RECORDING_ID,
      DELIVERY_TRANSCRIPT,
    );

    expect(result.insights).toHaveLength(4);
    expect(result.insights[0]).toMatchObject({
      category: "transaction",
      quantity: 200,
      quantityUnit: "units",
      packagingRequirements: "proper box",
    });
    expect(result.insights[1]).toMatchObject({
      category: "transaction",
      deliveryDestination: "Shweta enterprises",
    });
    expect(result.insights[2]).toMatchObject({
      category: "date",
      originalExpression: "13th of December",
    });
    expect(result.insights[3]).toMatchObject({
      category: "insight",
      deliveryTime: "around 3 p.m.",
    });
    expect(result.insights.every((insight) => insight.speakerId === null)).toBe(
      true,
    );
  });

  it("builds a grounded prompt with transcript evidence instructions", () => {
    const prompt = buildConversationAnalysisPrompt(RECORDING_ID, TRANSCRIPT);
    expect(prompt).toContain(RECORDING_ID);
    expect(prompt).toContain("Let us review the roadmap on Friday.");
    expect(prompt).toContain("exact quote");
    expect(prompt).toContain("speakerId");
    expect(prompt).toContain("quantities and units");
    expect(prompt).toContain("deliveryDestination");
    expect(prompt).toContain("one-to-three sentence summary");
  });
});
