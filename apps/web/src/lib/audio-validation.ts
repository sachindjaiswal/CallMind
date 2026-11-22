import {
  SUPPORTED_AUDIO_EXTENSIONS,
  isSupportedAudioExtension,
} from "@callmind/shared";
import { extensionOf, formatBytes } from "./format";

export function validateSelectedFile(
  file: File,
  maxFileSizeBytes: number,
): string | null {
  const extension = extensionOf(file.name);

  if (!isSupportedAudioExtension(extension)) {
    return `Unsupported format${extension ? ` ".${extension}"` : ""}. Use ${SUPPORTED_AUDIO_EXTENSIONS.map((item) => `.${item}`).join(", ")}.`;
  }

  if (file.size === 0) {
    return "The file is empty.";
  }

  if (file.size > maxFileSizeBytes) {
    return `Too large (${formatBytes(file.size)}; limit ${formatBytes(maxFileSizeBytes)}).`;
  }

  return null;
}
