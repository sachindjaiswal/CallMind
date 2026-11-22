import {
  RECORDING_STATUS_LABELS,
  type RecordingStatus,
} from "@callmind/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const variants: Record<RecordingStatus, BadgeProps["variant"]> = {
  uploaded: "secondary",
  queued: "warning",
  processing: "default",
  ready_for_transcription: "warning",
  transcription_queued: "warning",
  transcribing: "default",
  transcribed: "success",
  analysis_queued: "warning",
  analyzing: "default",
  analysis_completed: "success",
  analysis_failed: "destructive",
  failed: "destructive",
};

export function RecordingStatusBadge({ status }: { status: RecordingStatus }) {
  return <Badge variant={variants[status]}>{RECORDING_STATUS_LABELS[status]}</Badge>;
}
