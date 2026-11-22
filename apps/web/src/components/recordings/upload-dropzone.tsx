import { useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  disabled: boolean;
  maxFileSizeBytes: number;
  maxFilesPerUpload: number;
  supportedExtensions: readonly string[];
  onFilesSelected: (files: File[]) => void;
}

export function UploadDropzone({
  disabled,
  maxFileSizeBytes,
  maxFilesPerUpload,
  supportedExtensions,
  onFilesSelected,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) {
      return;
    }
    onFilesSelected(Array.from(event.dataTransfer.files));
  };

  const accept = supportedExtensions.map((item) => `.${item}`).join(",");

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30",
        disabled && "opacity-60",
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UploadCloud className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold">
        Drop audio files here or choose files
      </h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
        Up to {maxFilesPerUpload} files at a time, {formatBytes(maxFileSizeBytes)} per
        file. Supported:{" "}
        {supportedExtensions.map((item) => `.${item}`).join(", ")}
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(event) => {
          onFilesSelected(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-5"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Choose files
      </Button>
    </div>
  );
}
