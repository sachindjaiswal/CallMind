import {
  dailyReportConflictDecisionSchema,
  dailyReportConflictParamsSchema,
  dailyReportGenerateRequestSchema,
  dailyReportIdParamsSchema,
  dailyReportListQuerySchema,
} from "@callmind/shared";
import { Router } from "express";
import { ApiError } from "../lib/apiError";
import type { DailyReportService } from "../services/dailyReportService";

export interface DailyReportsRouterOptions {
  service: DailyReportService;
}

export function createDailyReportsRouter({
  service,
}: DailyReportsRouterOptions): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const parsed = dailyReportListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ApiError(
          400,
          "INVALID_QUERY",
          "The daily report list query is invalid.",
          parsed.error.issues,
        );
      }
      res.json(await service.list(parsed.data));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const parsed = dailyReportGenerateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(
          400,
          "INVALID_REPORT_REQUEST",
          "The daily report generation request is invalid.",
          parsed.error.issues,
        );
      }
      res.status(202).json(await service.generate(parsed.data));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/conflicts", async (req, res, next) => {
    try {
      const parsed = dailyReportIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        throw new ApiError(400, "INVALID_REPORT_ID", "The report id is invalid.");
      }
      res.json({ items: await service.listConflicts(parsed.data.id) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/conflicts/:conflictId", async (req, res, next) => {
    try {
      const params = dailyReportConflictParamsSchema.safeParse(req.params);
      const body = dailyReportConflictDecisionSchema.safeParse(req.body);
      if (!params.success || !body.success) {
        const details = !params.success
          ? params.error.issues
          : body.success
            ? []
            : body.error.issues;
        throw new ApiError(
          400,
          "INVALID_CONFLICT_DECISION",
          "The conflict review request is invalid.",
          details,
        );
      }
      res.json(
        await service.updateConflict(
          params.data.id,
          params.data.conflictId,
          body.data,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/regenerate", async (req, res, next) => {
    try {
      const parsed = dailyReportIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        throw new ApiError(400, "INVALID_REPORT_ID", "The report id is invalid.");
      }
      res.status(202).json(await service.regenerate(parsed.data.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const parsed = dailyReportIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        throw new ApiError(400, "INVALID_REPORT_ID", "The report id is invalid.");
      }
      res.json(await service.getById(parsed.data.id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
