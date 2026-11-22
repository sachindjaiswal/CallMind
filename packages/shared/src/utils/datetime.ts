const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function isValidReportDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map((value) => Number(value));
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map((value) => Number(value));
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(instant: number, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const values = new Map<string, number>();
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== "literal") {
      values.set(part.type, Number(part.value));
    }
  }

  return {
    year: values.get("year") ?? 0,
    month: values.get("month") ?? 0,
    day: values.get("day") ?? 0,
    hour: values.get("hour") ?? 0,
    minute: values.get("minute") ?? 0,
    second: values.get("second") ?? 0,
  };
}

function localMidnightToUtc(date: string, timeZone: string): number {
  const [year, month, day] = date.split("-").map((value) => Number(value));
  const target = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = target;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = getZonedParts(guess, timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const difference = represented - target;
    if (difference === 0) {
      break;
    }
    guess -= difference;
  }

  return guess;
}

export interface ZonedDateRange {
  start: Date;
  endExclusive: Date;
}

export function getZonedDateRange(
  date: string,
  timeZone: string,
): ZonedDateRange {
  if (!isValidReportDate(date)) {
    throw new Error(`Invalid reporting date: ${date}`);
  }
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Invalid timezone: ${timeZone}`);
  }

  return {
    start: new Date(localMidnightToUtc(date, timeZone)),
    endExclusive: new Date(localMidnightToUtc(addDays(date, 1), timeZone)),
  };
}

export function getDateInTimeZone(instant: Date | string, timeZone: string): string {
  const date =
    typeof instant === "string" ? new Date(instant) : instant;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const values = new Map<string, string>();
  for (const part of parts) {
    if (part.type !== "literal") {
      values.set(part.type, part.value);
    }
  }
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function isInstantInReportDate(
  instant: Date | string,
  date: string,
  timeZone: string,
): boolean {
  const value = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(value.getTime())) {
    return false;
  }
  const { start, endExclusive } = getZonedDateRange(date, timeZone);
  return value.getTime() >= start.getTime() && value.getTime() < endExclusive.getTime();
}
