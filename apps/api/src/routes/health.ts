import { Router } from "express";
import type { HealthResponse } from "@callmind/shared";

export function createHealthRouter(
  getHealth: () => Promise<HealthResponse>,
): Router {
  const router = Router();

  router.get("/health", async (_req, res, next) => {
    try {
      const health = await getHealth();
      res.status(health.status === "ok" ? 200 : 503).json(health);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
