import { describe, expect, it } from "vitest";
import {
  conversationAnalysisSchema,
  geminiAnalysisResponseSchema,
} from "./analysis";

const EVIDENCE = {
  recordingId: "64b7f9c2e1b2a4d5f6a7b8c9",
  segmentId: "seg-64b7f9c2e1b2a4d5f6a7b8c9-0",
  segmentIndex: 0,
  start: 0,
  end: 4,
  quote: "deliver 200 units to Shweta enterprises",
};

describe("conversation analysis schema", () => {
  it("preserves delivery-specific structured fields", () => {
    const parsed = conversationAnalysisSchema.parse({
      summary: "An order should be delivered to Shweta enterprises.",
      topics: ["delivery"],
      insights: [
        {
          category: "transaction",
          explicitness: "explicit",
          summary: "Deliver 200 units to Shweta enterprises.",
          evidence: EVIDENCE,
          quantity: 200,
          quantityUnit: "units",
          deliveryDestination: "Shweta enterprises",
          deliveryDate: "13th of December",
          deliveryTime: "around 3 p.m.",
          packagingRequirements: "proper box",
        },
      ],
    });

    expect(parsed.insights[0]).toMatchObject({
      quantity: 200,
      quantityUnit: "units",
      deliveryDestination: "Shweta enterprises",
      deliveryDate: "13th of December",
      deliveryTime: "around 3 p.m.",
      packagingRequirements: "proper box",
    });
  });

  it("defaults new structured fields to null for older analyses", () => {
    const parsed = conversationAnalysisSchema.parse({
      summary: "An order was mentioned.",
      topics: ["delivery"],
      insights: [
        {
          category: "transaction",
          explicitness: "explicit",
          summary: "An order was mentioned.",
          evidence: EVIDENCE,
        },
      ],
    });

    expect(parsed.insights[0]).toMatchObject({
      quantityUnit: null,
      deliveryDestination: null,
      deliveryDate: null,
      deliveryTime: null,
      packagingRequirements: null,
    });
  });

  it("exposes delivery-specific fields in the Gemini response schema", () => {
    const insightSchema = geminiAnalysisResponseSchema.properties.insights
      .items as unknown as { properties: Record<string, unknown> };

    expect(Object.keys(insightSchema.properties)).toEqual(
      expect.arrayContaining([
        "quantityUnit",
        "deliveryDestination",
        "deliveryDate",
        "deliveryTime",
        "packagingRequirements",
      ]),
    );
  });
});
