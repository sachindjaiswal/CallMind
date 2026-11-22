import cors from "cors";
import express, { type Router } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import type { Logger } from "pino";
import type { HealthResponse } from "@callmind/shared";
import {
  createErrorHandler,
  createNotFoundHandler,
} from "./middleware/errorHandler";
import { createHealthRouter } from "./routes/health";
import { APP_VERSION } from "./services/health";

export interface AppOptions {
  getHealth: () => Promise<HealthResponse>;
  corsOrigins: string[];
  logger: Logger;
  recordingsRouter?: Router;
  dailyReportsRouter?: Router;
}

export function createApp({
  getHealth,
  corsOrigins,
  logger,
  recordingsRouter,
  dailyReportsRouter,
}: AppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/api/health",
      },
    }),
  );

  app.get("/api", (_req, res) => {
    res.json({ service: "callmind-api", version: APP_VERSION });
  });

  app.use("/api", createHealthRouter(getHealth));

  if (recordingsRouter) {
    app.use("/api/recordings", recordingsRouter);
  }

  if (dailyReportsRouter) {
    app.use("/api/daily-reports", dailyReportsRouter);
  }

  app.use(createNotFoundHandler());
  app.use(createErrorHandler(logger));

  return app;
}
