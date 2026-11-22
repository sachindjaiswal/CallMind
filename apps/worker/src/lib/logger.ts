import pino, { type Logger } from "pino";

export function createLogger(service: string, level: string): Logger {
  return pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
