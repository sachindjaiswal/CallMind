import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { RecordingList } from "@/components/recordings/recording-list";
import { UploadDropzone } from "@/components/recordings/upload-dropzone";
import { UploadQueue } from "@/components/recordings/upload-queue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRecordings } from "@/hooks/use-recordings";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import {
  fetchRecording,
  fetchRecordingConfig,
  retryRecording,
} from "@/lib/api";
import {
  mergeRecordings,
  parseRecordingDeepLink,
} from "@/lib/recording-deep-link";
import {
  DEFAULT_MAX_FILES_PER_UPLOAD,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_STT_LANGUAGE_HINT,
  STT_LANGUAGE_HINT_LABELS,
  STT_LANGUAGE_HINTS,
  type RecordingConfig,
  type RecordingDto,
  type SttLanguageHint,
  SUPPORTED_AUDIO_EXTENSIONS,
} from "@callmind/shared";

const fallbackConfig: RecordingConfig = {
  maxFileSizeBytes: DEFAULT_MAX_UPLOAD_BYTES,
  maxFilesPerUpload: DEFAULT_MAX_FILES_PER_UPLOAD,
  supportedExtensions: [...SUPPORTED_AUDIO_EXTENSIONS],
  supportedLanguageHints: [...STT_LANGUAGE_HINTS],
};

export default function RecordingsPage() {
  const [config, setConfig] = useState<RecordingConfig>(fallbackConfig);
  const [configError, setConfigError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [languageHint, setLanguageHint] = useState<SttLanguageHint>(
    DEFAULT_STT_LANGUAGE_HINT,
  );

  const recordings = useRecordings();
  const [searchParams] = useSearchParams();
  const deepLinkKey = searchParams.toString();
  const deepLink = useMemo(
    () => parseRecordingDeepLink(deepLinkKey),
    [deepLinkKey],
  );
  const [linkedRecording, setLinkedRecording] = useState<RecordingDto | null>(
    null,
  );
  const [linkStatus, setLinkStatus] = useState<
    "idle" | "loading" | "unavailable"
  >("idle");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkAttempt, setLinkAttempt] = useState(0);
  const handledLinkRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deepLink) {
      handledLinkRef.current = deepLinkKey;
      setLinkedRecording(null);
      setLinkStatus("idle");
      setLinkError(null);
      return;
    }

    if (handledLinkRef.current === deepLinkKey) {
      return;
    }

    if (recordings.items.some((item) => item.id === deepLink.recordingId)) {
      handledLinkRef.current = deepLinkKey;
      setLinkedRecording(null);
      setLinkError(null);
      setLinkStatus("idle");
      return;
    }

    // Wait for the initial list before falling back to a direct fetch, so a
    // recording that is already listed is not fetched unnecessarily.
    if (recordings.loading) {
      return;
    }

    handledLinkRef.current = deepLinkKey;
    setLinkedRecording(null);
    setLinkError(null);

    let cancelled = false;
    setLinkStatus("loading");
    fetchRecording(deepLink.recordingId)
      .then((recording) => {
        if (!cancelled) {
          setLinkedRecording(recording);
          setLinkStatus("idle");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLinkStatus("unavailable");
          setLinkError(
            error instanceof Error
              ? error.message
              : "Could not load the source recording.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    deepLink,
    deepLinkKey,
    linkAttempt,
    recordings.items,
    recordings.loading,
  ]);

  const visibleRecordings = useMemo(
    () => mergeRecordings(recordings.items, linkedRecording),
    [recordings.items, linkedRecording],
  );

  const focusTarget = useMemo(
    () => (deepLink ? { ...deepLink, requestKey: deepLinkKey } : null),
    [deepLink, deepLinkKey],
  );

  const uploadQueue = useUploadQueue({
    maxFileSizeBytes: config.maxFileSizeBytes,
    maxFilesPerUpload: config.maxFilesPerUpload,
    languageHint,
    onUploadsFinished: recordings.refresh,
  });

  useEffect(() => {
    let active = true;

    fetchRecordingConfig()
      .then((value) => {
        if (active) {
          setConfig(value);
          setConfigError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setConfigError(
            error instanceof Error
              ? error.message
              : "Could not load upload settings.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleRetry = async (id: string): Promise<void> => {
    setRetryingId(id);
    setActionError(null);
    try {
      await retryRecording(id);
      await recordings.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not retry recording.",
      );
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recordings</h1>
          <p className="text-sm text-muted-foreground">
            Upload conversations and follow their preparation, transcription and analysis status.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void recordings.refresh()}
          disabled={recordings.loading}
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {configError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Upload settings could not be loaded; using safe defaults. {configError}
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {actionError}
        </p>
      ) : null}

      <section aria-labelledby="upload-heading" className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 id="upload-heading" className="text-sm font-semibold tracking-tight">
            Upload audio
          </h2>
          <p className="text-xs text-muted-foreground">
            Files are validated and prepared in the background. Duplicates are
            detected by content.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label
                htmlFor="transcription-language"
                className="text-xs font-medium"
              >
                Transcription language
              </label>
              <select
                id="transcription-language"
                value={languageHint}
                disabled={uploadQueue.isUploading}
                onChange={(event) =>
                  setLanguageHint(event.target.value as SttLanguageHint)
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {STT_LANGUAGE_HINTS.map((hint) => (
                  <option key={hint} value={hint}>
                    {STT_LANGUAGE_HINT_LABELS[hint]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Auto and non-English files use Gemini Transcribe; English files
                use Groq Turbo.
              </p>
            </div>

            <UploadDropzone
              disabled={uploadQueue.isUploading}
              maxFileSizeBytes={config.maxFileSizeBytes}
              maxFilesPerUpload={config.maxFilesPerUpload}
              supportedExtensions={config.supportedExtensions}
              onFilesSelected={uploadQueue.addFiles}
            />

            {uploadQueue.selectionError ? (
              <p className="text-xs leading-relaxed text-destructive">
                {uploadQueue.selectionError}
              </p>
            ) : null}

            <UploadQueue
              items={uploadQueue.items}
              onRemove={uploadQueue.removeItem}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void uploadQueue.uploadAll()}
                disabled={uploadQueue.pendingCount === 0 || uploadQueue.isUploading}
              >
                {uploadQueue.isUploading ? (
                  <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                Upload {uploadQueue.pendingCount > 0 ? uploadQueue.pendingCount : ""}
                {uploadQueue.pendingCount === 1 ? " file" : " files"}
              </Button>

              {uploadQueue.finishedCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={uploadQueue.isUploading}
                  onClick={uploadQueue.clearFinished}
                >
                  Clear finished
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="history-heading" className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2
            id="history-heading"
            className="text-sm font-semibold tracking-tight"
          >
            History
          </h2>
          <p className="text-xs text-muted-foreground">
            {recordings.loading && visibleRecordings.length === 0
              ? "Loading…"
              : `${visibleRecordings.length} recording${visibleRecordings.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {linkStatus === "loading" ? (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            Opening source recording…
          </p>
        ) : null}

        {linkStatus === "unavailable" ? (
          <div
            role="status"
            className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
          >
            <p className="font-medium">Source recording unavailable</p>
            <p>
              The recording linked from this evidence could not be loaded
              {linkError ? `: ${linkError}` : "."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handledLinkRef.current = null;
                setLinkAttempt((attempt) => attempt + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : null}

        <RecordingList
          items={visibleRecordings}
          loading={recordings.loading}
          error={recordings.error}
          retryingId={retryingId}
          focus={focusTarget}
          onRetry={(id) => void handleRetry(id)}
          onRefresh={() => void recordings.refresh()}
        />
      </section>
    </div>
  );
}
