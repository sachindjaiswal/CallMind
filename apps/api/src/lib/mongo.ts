import mongoose from "mongoose";
import type { Logger } from "pino";

export async function connectMongo(uri: string, logger: Logger): Promise<void> {
  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected");
  });
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
  mongoose.connection.on("error", (error: unknown) => {
    logger.error({ err: error }, "MongoDB connection error");
  });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

export async function pingMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB connection is not ready");
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB database handle is unavailable");
  }

  await db.admin().ping();
}
