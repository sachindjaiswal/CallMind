import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { SupportedAudioExtension } from "@callmind/shared";
import { ApiError } from "./apiError";

export interface StorageLayout {
  root: string;
  tempDir: string;
  audioDir: string;
}

export async function initStorage(storageRoot: string): Promise<StorageLayout> {
  const root = resolve(storageRoot);
  const tempDir = resolve(root, "tmp");
  const audioDir = resolve(root, "audio");

  await mkdir(root, { recursive: true });
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });
  await mkdir(audioDir, { recursive: true });

  return { root, tempDir, audioDir };
}

export function resolveStoragePath(storageRoot: string, storageKey: string) {
  const root = resolve(storageRoot);
  const fullPath = resolve(root, storageKey);

  if (fullPath !== root && !fullPath.startsWith(root + sep)) {
    throw new ApiError(
      400,
      "INVALID_STORAGE_KEY",
      "The recording storage key is invalid.",
    );
  }

  return fullPath;
}

export function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function buildStorageKey(
  workspaceId: string,
  extension: SupportedAudioExtension,
  now: Date = new Date(),
): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const workspace = sanitizeSegment(workspaceId) || "default";

  return ["audio", workspace, year, month, `${randomUUID()}.${extension}`].join(
    "/",
  );
}

export async function moveIntoStorage(
  tempPath: string,
  storageRoot: string,
  storageKey: string,
): Promise<string> {
  const destination = resolveStoragePath(storageRoot, storageKey);
  await mkdir(dirname(destination), { recursive: true });

  try {
    await rename(tempPath, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EXDEV") {
      await copyFile(tempPath, destination);
      await unlink(tempPath);
    } else {
      throw error;
    }
  }

  return destination;
}

export async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
