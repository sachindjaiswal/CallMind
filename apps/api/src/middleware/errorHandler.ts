import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import type { Logger } from "pino";
import { ApiError } from "../lib/apiError";

export function createNotFoundHandler(): RequestHandler {
  return (req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        path: req.originalUrl,
      },
    });
  };
}

function multerErrorResponse(error: multer.MulterError): {
  status: number;
  code: string;
  message: string;
} {
  switch (error.code) {
    case "LIMIT_FILE_SIZE":
      return {
        status: 413,
        code: "FILE_TOO_LARGE",
        message: "One or more files exceed the upload size limit.",
      };
    case "LIMIT_FILE_COUNT":
      return {
        status: 400,
        code: "TOO_MANY_FILES",
        message: "Too many files were attached to the upload.",
      };
    case "LIMIT_UNEXPECTED_FILE":
      return {
        status: 400,
        code: "UNEXPECTED_FIELD",
        message: 'Upload files using the "files" field.',
      };
    default:
      return {
        status: 400,
        code: "UPLOAD_ERROR",
        message: "The upload could not be processed.",
      };
  }
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    if (res.headersSent) {
      return;
    }

    if (error instanceof ApiError) {
      const log = error.statusCode >= 500 ? logger.error : logger.warn;
      log.call(logger, { err: error, path: req.originalUrl }, "Request failed");

      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
      return;
    }

    if (error instanceof multer.MulterError) {
      const mapped = multerErrorResponse(error);
      logger.warn(
        { err: error, path: req.originalUrl },
        "Upload request rejected",
      );

      res.status(mapped.status).json({
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      });
      return;
    }

    logger.error({ err: error, path: req.originalUrl }, "Unhandled request error");

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  };
}
