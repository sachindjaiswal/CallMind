import { useCallback, useState } from "react";
import type { SttLanguageHint } from "@callmind/shared";
import { validateSelectedFile } from "@/lib/audio-validation";
import { uploadRecording } from "@/lib/api";

export type UploadItemStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "duplicate"
  | "rejected"
  | "error";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: UploadItemStatus;
  error?: string;
  duplicateOf?: string;
}

interface UseUploadQueueOptions {
  maxFileSizeBytes: number;
  maxFilesPerUpload: number;
  languageHint: SttLanguageHint;
  onUploadsFinished?: () => Promise<void> | void;
}

function sameFile(first: File, second: File): boolean {
  return (
    first.name === second.name &&
    first.size === second.size &&
    first.lastModified === second.lastModified
  );
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useUploadQueue({
  maxFileSizeBytes,
  maxFilesPerUpload,
  languageHint,
  onUploadsFinished,
}: UseUploadQueueOptions) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const addFiles = useCallback(
    (files: File[]) => {
      if (!files.length || isUploading) {
        return;
      }

      const problems: string[] = [];
      const additions: UploadItem[] = [];
      let pendingCount = items.filter((item) => item.status === "pending").length;

      for (const file of files) {
        if (pendingCount >= maxFilesPerUpload) {
          problems.push(`Only ${maxFilesPerUpload} files can be queued at once.`);
          break;
        }

        if (items.some((item) => sameFile(item.file, file))) {
          problems.push(`${file.name} is already selected.`);
          continue;
        }

        const problem = validateSelectedFile(file, maxFileSizeBytes);
        if (problem) {
          problems.push(`${file.name}: ${problem}`);
          continue;
        }

        additions.push({
          id: newId(),
          file,
          progress: 0,
          status: "pending",
        });
        pendingCount += 1;
      }

      setSelectionError(problems.length > 0 ? problems.join(" ") : null);
      if (additions.length > 0) {
        setItems((previous) => [...previous, ...additions]);
      }
    },
    [isUploading, items, maxFilesPerUpload, maxFileSizeBytes],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<UploadItem>) => {
      setItems((previous) =>
        previous.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const removeItem = useCallback(
    (id: string) => {
      if (isUploading) {
        return;
      }
      setItems((previous) => previous.filter((item) => item.id !== id));
    },
    [isUploading],
  );

  const uploadAll = useCallback(async () => {
    const pending = items.filter((item) => item.status === "pending");
    if (!pending.length || isUploading) {
      return;
    }

    setIsUploading(true);
    setSelectionError(null);

    for (const item of pending) {
      updateItem(item.id, { status: "uploading", progress: 0 });

      try {
        const result = await uploadRecording(
          item.file,
          languageHint,
          (progress) => {
            updateItem(item.id, { progress });
          },
        );

        updateItem(item.id, {
          status:
            result.status === "created"
              ? "uploaded"
              : result.status === "duplicate"
                ? "duplicate"
                : "rejected",
          progress: 100,
          duplicateOf: result.duplicateOf ?? undefined,
          error: result.error?.message,
        });
      } catch (error) {
        updateItem(item.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed.",
        });
      }
    }

    setIsUploading(false);
    await onUploadsFinished?.();
  }, [isUploading, items, languageHint, onUploadsFinished, updateItem]);

  const clearFinished = useCallback(() => {
    if (isUploading) {
      return;
    }
    setItems((previous) =>
      previous.filter(
        (item) => item.status === "pending" || item.status === "uploading",
      ),
    );
    setSelectionError(null);
  }, [isUploading]);

  const pendingCount = items.filter((item) => item.status === "pending").length;
  const finishedCount = items.filter(
    (item) =>
      item.status !== "pending" && item.status !== "uploading",
  ).length;

  return {
    items,
    isUploading,
    selectionError,
    pendingCount,
    finishedCount,
    addFiles,
    removeItem,
    uploadAll,
    clearFinished,
  };
}
