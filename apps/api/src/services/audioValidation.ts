import { open, stat } from "node:fs/promises";
import { extname } from "node:path";
import {
  AUDIO_MIME_BY_EXTENSION,
  SUPPORTED_AUDIO_EXTENSIONS,
  isSupportedAudioExtension,
  type SupportedAudioExtension,
} from "@callmind/shared";
import { fromFile } from "file-type";
import { ApiError } from "../lib/apiError";

export interface AudioValidationInput {
  filePath: string;
  originalFilename: string;
  maxSizeBytes: number;
}

export interface ValidatedAudio {
  extension: SupportedAudioExtension;
  detectedMimeType: string;
  sizeBytes: number;
}

export function getExtensionFromFilename(filename: string): string {
  return extname(filename).replace(/^\./, "").toLowerCase();
}

const ASF_SIGNATURE = Buffer.from([
  0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa,
  0x00, 0x62, 0xce, 0x6c,
]);

async function hasAsfSignature(filePath: string): Promise<boolean> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(ASF_SIGNATURE.length);
    const { bytesRead } = await handle.read(
      buffer,
      0,
      ASF_SIGNATURE.length,
      0,
    );
    return bytesRead === ASF_SIGNATURE.length && buffer.equals(ASF_SIGNATURE);
  } finally {
    await handle.close();
  }
}

export async function validateAudioFile(
  input: AudioValidationInput,
): Promise<ValidatedAudio> {
  const rawExtension = getExtensionFromFilename(input.originalFilename);

  if (!rawExtension) {
    throw new ApiError(
      422,
      "UNSUPPORTED_FORMAT",
      "The file has no extension. Supported formats: " +
        SUPPORTED_AUDIO_EXTENSIONS.join(", ") +
        ".",
    );
  }

  if (!isSupportedAudioExtension(rawExtension)) {
    throw new ApiError(
      422,
      "UNSUPPORTED_FORMAT",
      `Unsupported audio format ".${rawExtension}". Supported formats: ` +
        SUPPORTED_AUDIO_EXTENSIONS.join(", ") +
        ".",
    );
  }

  const extension = rawExtension.toLowerCase() as SupportedAudioExtension;
  const stats = await stat(input.filePath);

  if (stats.size === 0) {
    throw new ApiError(422, "EMPTY_FILE", "The uploaded file is empty.");
  }

  if (stats.size > input.maxSizeBytes) {
    throw new ApiError(
      413,
      "FILE_TOO_LARGE",
      `The file exceeds the ${input.maxSizeBytes / (1024 * 1024)} MiB limit.`,
    );
  }

  if (await hasAsfSignature(input.filePath)) {
    throw new ApiError(
      422,
      "INVALID_SIGNATURE",
      "ASF/WMA files are not supported.",
    );
  }

  const detected = await fromFile(input.filePath);

  if (!detected) {
    throw new ApiError(
      422,
      "INVALID_SIGNATURE",
      "The file contents do not match a supported audio format.",
    );
  }

  const allowedMimeTypes = AUDIO_MIME_BY_EXTENSION[extension];
  if (!allowedMimeTypes.includes(detected.mime)) {
    throw new ApiError(
      422,
      "INVALID_SIGNATURE",
      `The file contents (${detected.mime}) do not match the ".${extension}" extension.`,
    );
  }

  return {
    extension,
    detectedMimeType: detected.mime,
    sizeBytes: stats.size,
  };
}
