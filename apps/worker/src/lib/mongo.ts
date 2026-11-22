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
