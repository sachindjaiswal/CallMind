import type { RecordingStatus } from "@callmind/shared";

/**
 * Explicit recording state machine.
 *
 * uploaded -> queued -> processing -> ready_for_transcription
 *          -> transcription_queued -> transcribing -> transcribed
 *          -> analysis_queued -> analyzing -> analysis_completed
 * failed -> queued | transcription_queued | analysis_queued (manual retry)
 */
export const RECORDING_STATUS_TRANSITIONS: Record<
  RecordingStatus,
  readonly RecordingStatus[]
> = {
  uploaded: ["queued", "failed"],
  queued: ["processing", "failed"],
  processing: ["ready_for_transcription", "queued", "failed"],
  ready_for_transcription: ["transcription_queued", "failed"],
  transcription_queued: ["transcribing", "failed"],
  transcribing: ["transcribed", "transcription_queued", "failed"],
  transcribed: ["analysis_queued", "failed"],
  analysis_queued: ["analyzing", "analysis_failed", "failed"],
  analyzing: [
    "analysis_completed",
    "analysis_queued",
    "analysis_failed",
    "failed",
  ],
  analysis_completed: ["analysis_queued"],
  analysis_failed: ["analysis_queued"],
  failed: ["queued", "transcription_queued", "analysis_queued"],
};

export function canTransitionRecording(
  from: RecordingStatus,
  to: RecordingStatus,
): boolean {
  return RECORDING_STATUS_TRANSITIONS[from].includes(to);
}
