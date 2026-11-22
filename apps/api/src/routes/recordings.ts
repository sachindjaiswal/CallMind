import { randomUUID } from "node:crypto";
import {
  recordingListQuerySchema,
  sttLanguageHintSchema,
  type UploadFileResult,
} from "@callmind/shared";
import { Router } from "express";
import multer from "multer";
import type { Logger } from "pino";
import { ApiError } from "../lib/apiError";
import { removeFileIfExists } from "../lib/storage";
import type { RecordingService } from "../services/recordingService";

export interface RecordingsRouterOptions {
  service: RecordingService;
  tempDir: string;
  maxFileSizeBytes: number;
  maxFilesPerUpload: number;
  logger: Logger;
}

export function createRecordingsRouter({
  service,
  tempDir,
  maxFileSizeBytes,
  maxFilesPerUpload,
  logger,
}: RecordingsRouterOptions): Router {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        callback(null, tempDir);
      },
      filename: (_req, _file, callback) => {
        callback(null, `${randomUUID()}.upload`);
      },
    }),
    limits: {
      // Accept files up to twice the configured limit so that individually
      // oversized files can be rejected per-file with a useful message. The
      // request-level 413 only applies beyond this hard cap.
      fileSize: maxFileSizeBytes * 2,
      files: maxFilesPerUpload,
    },
  });

  const router = Router();

  router.get("/config", (_req, res) => {
    res.json(service.config());
  });

  router.get("/", async (req, res, next) => {
    try {
      const parsed = recordingListQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new ApiError(
          400,
          "INVALID_QUERY",
          "The recording list query is invalid.",
          parsed.error.issues,
        );
      }

      res.json(await service.list(parsed.data));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      res.json(await service.getById(req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/upload",
    upload.array("files", maxFilesPerUpload),
    async (req, res, next) => {
      try {
        const files = (req.files ?? []) as Express.Multer.File[];

        if (files.length === 0) {
          throw new ApiError(
            400,
            "NO_FILES",
            'Attach at least one audio file using the "files" field.',
          );
        }

        const parsedLanguageHint = sttLanguageHintSchema.safeParse(
          req.body.languageHint ?? "auto",
        );

        if (!parsedLanguageHint.success) {
          await Promise.all(files.map((file) => removeFileIfExists(file.path)));
          throw new ApiError(
            400,
            "INVALID_LANGUAGE_HINT",
            "The transcription language hint is invalid.",
            parsedLanguageHint.error.issues,
          );
        }

        const results: UploadFileResult[] = [];

        for (const file of files) {
          try {
            results.push(
              await service.processUpload({
                tempPath: file.path,
                originalFilename: file.originalname,
                sizeBytes: file.size,
                languageHint: parsedLanguageHint.data,
              }),
            );
          } catch (error) {
            if (error instanceof ApiError) {
              results.push({
                originalFilename: file.originalname,
                status: "rejected",
                recording: null,
                duplicateOf: null,
                error: {
                  code: error.code,
                  message: error.message,
                },
              });
              continue;
            }

            logger.error(
              { err: error, filename: file.originalname },
              "Unexpected error while processing upload",
            );
            results.push({
              originalFilename: file.originalname,
              status: "rejected",
              recording: null,
              duplicateOf: null,
              error: {
                code: "UPLOAD_FAILED",
                message:
                  "An unexpected error occurred while processing this file.",
              },
            });
          }
        }

        const summary = {
          created: results.filter((result) => result.status === "created")
            .length,
          duplicate: results.filter((result) => result.status === "duplicate")
            .length,
          rejected: results.filter((result) => result.status === "rejected")
            .length,
        };

        res.status(summary.created > 0 ? 201 : 200).json({ results, summary });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/:id/retry", async (req, res, next) => {
    try {
      res.json(await service.retry(req.params.id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
