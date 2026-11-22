import { z } from "zod";
import {
  ANALYSIS_PROVIDERS,
  ANALYSIS_STATUSES,
} from "../constants/recordings";

export const INSIGHT_CATEGORIES = [
  "topic",
  "person",
  "task",
  "date",
  "decision",
  "commitment",
  "transaction",
  "project",
  "risk",
  "question",
  "insight",
] as const;

export const INSIGHT_CERTAINTIES = ["explicit", "inferred"] as const;
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export const TASK_DIRECTIONS = [
  "assigned_by_uploader",
  "assigned_to_uploader",
  "between_participants",
  "unknown",
] as const;

export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];
export type InsightCertainty = (typeof INSIGHT_CERTAINTIES)[number];
export type TaskDirection = (typeof TASK_DIRECTIONS)[number];

function nullableText() {
  return z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => value ?? null);
}

function nullableNumber() {
  return z
    .number()
    .nullable()
    .optional()
    .transform((value) => value ?? null);
}

function textArray() {
  return z.array(z.string().trim().min(1)).default([]);
}

export const analysisEvidenceSchema = z
  .object({
    recordingId: z.string().min(1),
    segmentId: nullableText(),
    segmentIndex: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    start: z.number().nonnegative(),
    end: z.number().nonnegative(),
    quote: z.string().trim().min(1),
  })
  .refine(
    (evidence) => evidence.segmentId !== null || evidence.segmentIndex !== null,
    { message: "Evidence must reference a transcript segment id or index." },
  );

export const insightSchema = z.object({
  category: z.enum(INSIGHT_CATEGORIES),
  explicitness: z.enum(INSIGHT_CERTAINTIES),
  confidence: z
    .enum(CONFIDENCE_LEVELS)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  summary: z.string().trim().min(1),
  speakerId: z
    .string()
    .nullable()
    .optional()
    .transform(() => null),
  evidence: analysisEvidenceSchema,
  name: nullableText(),
  role: nullableText(),
  contactInfo: nullableText(),
  description: nullableText(),
  assignedBy: nullableText(),
  assignedTo: nullableText(),
  taskDirection: z
    .enum(TASK_DIRECTIONS)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  deadlineOriginal: nullableText(),
  dueDate: nullableText(),
  status: nullableText(),
  originalExpression: nullableText(),
  normalizedDate: nullableText(),
  dateType: nullableText(),
  referenceDate: nullableText(),
  participants: textArray(),
  madeBy: nullableText(),
  concerns: nullableText(),
  productOrService: nullableText(),
  quantity: nullableNumber(),
  quantityUnit: nullableText(),
  amount: nullableNumber(),
  currency: nullableText(),
  paymentStatus: nullableText(),
  deliveryStatus: nullableText(),
  deliveryDestination: nullableText(),
  deliveryDate: nullableText(),
  deliveryTime: nullableText(),
  packagingRequirements: nullableText(),
  milestone: nullableText(),
  severity: nullableText(),
  question: nullableText(),
  askedBy: nullableText(),
  relatedPeople: textArray(),
  relatedProjects: textArray(),
});

export type ConversationInsight = z.infer<typeof insightSchema>;
export type AnalysisEvidence = z.infer<typeof analysisEvidenceSchema>;

export const conversationAnalysisSchema = z.object({
  summary: z.string().trim().min(1),
  topics: z.array(z.string().trim().min(1)).max(30).default([]),
  insights: z.array(insightSchema).max(100).default([]),
});

export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema>;

export const analysisErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string(),
  occurredAt: z.string().optional(),
});

export const analysisDtoSchema = z.object({
  id: z.string(),
  recordingId: z.string(),
  transcriptId: z.string(),
  status: z.enum(ANALYSIS_STATUSES),
  provider: z.enum(ANALYSIS_PROVIDERS),
  model: z.string(),
  fallbackUsed: z.boolean(),
  attemptedModels: z.array(z.string()),
  schemaVersion: z.string(),
  promptVersion: z.string(),
  summary: z.string().nullable(),
  topics: z.array(z.string()),
  insights: z.array(insightSchema),
  error: analysisErrorSchema.nullable(),
  analyzedAt: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AnalysisDto = z.infer<typeof analysisDtoSchema>;

const nullableStringSchema = { type: "STRING", nullable: true } as const;
const nullableNumberSchema = { type: "NUMBER", nullable: true } as const;
const stringArraySchema = {
  type: "ARRAY",
  items: { type: "STRING" },
} as const;

export const geminiAnalysisResponseSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    topics: stringArraySchema,
    insights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING", enum: [...INSIGHT_CATEGORIES] },
          explicitness: { type: "STRING", enum: [...INSIGHT_CERTAINTIES] },
          confidence: {
            type: "STRING",
            enum: [...CONFIDENCE_LEVELS],
            nullable: true,
          },
          summary: { type: "STRING" },
          speakerId: nullableStringSchema,
          evidence: {
            type: "OBJECT",
            properties: {
              recordingId: { type: "STRING" },
              segmentId: nullableStringSchema,
              segmentIndex: { type: "INTEGER", nullable: true },
              start: { type: "NUMBER" },
              end: { type: "NUMBER" },
              quote: { type: "STRING" },
            },
            required: ["recordingId", "start", "end", "quote"],
          },
          name: nullableStringSchema,
          role: nullableStringSchema,
          contactInfo: nullableStringSchema,
          description: nullableStringSchema,
          assignedBy: nullableStringSchema,
          assignedTo: nullableStringSchema,
          taskDirection: {
            type: "STRING",
            enum: [...TASK_DIRECTIONS],
            nullable: true,
          },
          deadlineOriginal: nullableStringSchema,
          dueDate: nullableStringSchema,
          status: nullableStringSchema,
          originalExpression: nullableStringSchema,
          normalizedDate: nullableStringSchema,
          dateType: nullableStringSchema,
          referenceDate: nullableStringSchema,
          participants: stringArraySchema,
          madeBy: nullableStringSchema,
          concerns: nullableStringSchema,
          productOrService: nullableStringSchema,
          quantity: nullableNumberSchema,
          quantityUnit: nullableStringSchema,
          amount: nullableNumberSchema,
          currency: nullableStringSchema,
          paymentStatus: nullableStringSchema,
          deliveryStatus: nullableStringSchema,
          deliveryDestination: nullableStringSchema,
          deliveryDate: nullableStringSchema,
          deliveryTime: nullableStringSchema,
          packagingRequirements: nullableStringSchema,
          milestone: nullableStringSchema,
          severity: nullableStringSchema,
          question: nullableStringSchema,
          askedBy: nullableStringSchema,
          relatedPeople: stringArraySchema,
          relatedProjects: stringArraySchema,
        },
        required: ["category", "explicitness", "summary", "evidence"],
      },
    },
  },
  required: ["summary", "topics", "insights"],
} as const;
