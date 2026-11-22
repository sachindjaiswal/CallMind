import { Check, Copy, FileAudio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UploadItem } from "@/hooks/use-upload-queue";
import { extensionLabel, formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

interface UploadQueueProps {
  items: UploadItem[];
  onRemove: (id: string) => void;
}

const statusStyles: Record<UploadItem["status"], string> = {
  pending: "text-muted-foreground",
  uploading: "text-primary",
  uploaded: "text-emerald-600 dark:text-emerald-400",
  duplicate: "text-amber-600 dark:text-amber-400",
  rejected: "text-destructive",
  error: "text-destructive",
};

function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case "pending":
      return "Ready";
    case "uploading":
      return `${item.progress}% uploaded`;
    case "uploaded":
      return "Uploaded";
    case "duplicate":
      return "Duplicate";
    case "rejected":
      return "Rejected";
    case "error":
      return "Failed";
  }
}

export function UploadQueue({ items, onRemove }: UploadQueueProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {item.status === "uploaded" ? (
              <Check className="h-4 w-4" />
            ) : item.status === "duplicate" ? (
              <Copy className="h-4 w-4" />
            ) : (
              <FileAudio className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium">{item.file.name}</p>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  statusStyles[item.status],
                )}
              >
                {statusLabel(item)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(item.file.size)} · {extensionLabel(item.file.name)}
            </p>
            {item.status === "uploading" ? (
              <Progress value={item.progress} aria-label="Upload progress" />
            ) : null}
            {item.error ? (
              <p className="text-xs text-destructive">{item.error}</p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${item.file.name}`}
            disabled={item.status === "uploading"}
            onClick={() => onRemove(item.id)}
          >
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}
