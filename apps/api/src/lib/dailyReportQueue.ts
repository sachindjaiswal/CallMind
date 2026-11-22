import {
  DAILY_REPORT_JOB_ATTEMPTS,
  DAILY_REPORT_JOB_BACKOFF_MS,
  QUEUES,
  type DailyReportJobData,
} from "@callmind/shared";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface DailyReportQueue {
  enqueueReport(reportId: string): Promise<void>;
  close(): Promise<void>;
}

export function createDailyReportQueue(connection: Redis): DailyReportQueue {
  const queue = new Queue<DailyReportJobData>(QUEUES.DAILY_REPORT, {
    connection,
  });

  return {
    async enqueueReport(reportId: string): Promise<void> {
      await queue.add(
        "generate",
        { reportId },
        {
          jobId: reportId,
          attempts: DAILY_REPORT_JOB_ATTEMPTS,
          backoff: {
            type: "exponential",
            delay: DAILY_REPORT_JOB_BACKOFF_MS,
          },
          removeOnComplete: 500,
          removeOnFail: 1_000,
        },
      );
    },
    async close(): Promise<void> {
      await queue.close();
    },
  };
}
