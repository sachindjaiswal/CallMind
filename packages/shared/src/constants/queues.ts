export const QUEUES = {
  TEST: "callmind-test",
  RECORDING_PREPARE: "callmind-recording-prepare",
  RECORDING_TRANSCRIBE: "callmind-recording-transcribe",
  RECORDING_ANALYZE: "callmind-recording-analyze",
  DAILY_REPORT: "callmind-daily-report",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface TestJobData {
  message: string;
  requestedAt: string;
}

export interface TestJobResult {
  ok: true;
  message: string;
  processedAt: string;
}

export interface RecordingPrepareJobData {
  recordingId: string;
}

export interface RecordingPrepareJobResult {
  ok: boolean;
  recordingId: string;
  skipped?: boolean;
  durationSeconds?: number | null;
}

export interface RecordingTranscribeJobData {
  recordingId: string;
}

export interface RecordingTranscribeJobResult {
  ok: boolean;
  recordingId: string;
  skipped?: boolean;
  language?: string;
  durationSeconds?: number;
}

export interface RecordingAnalyzeJobData {
  recordingId: string;
}

export interface RecordingAnalyzeJobResult {
  ok: boolean;
  recordingId: string;
  skipped?: boolean;
  analysisId?: string;
  model?: string;
  fallbackUsed?: boolean;
}

export interface DailyReportJobData {
  reportId: string;
}

export interface DailyReportJobResult {
  ok: boolean;
  reportId: string;
  skipped?: boolean;
  insightCount?: number;
  relationshipCount?: number;
  conflictCount?: number;
}
