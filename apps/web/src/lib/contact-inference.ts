export type InferredContactConfidence = "medium" | "low";

export type InferredContactReason =
  | "name_after_generic_prefix"
  | "name_with_date_suffix"
  | "name_only"
  | "generic_only"
  | "phone_or_numeric_only";

export interface InferredContact {
  name: string | null;
  confidence: InferredContactConfidence;
  source: "filename";
  originalFilename: string;
  reason: InferredContactReason;
}

interface FilenameToken {
  text: string;
  lower: string;
  hasDigit: boolean;
}

const AUDIO_EXTENSIONS = new Set([
  "3gp",
  "aac",
  "aif",
  "aiff",
  "amr",
  "caf",
  "flac",
  "m4a",
  "m4b",
  "mp3",
  "mp4",
  "oga",
  "ogg",
  "opus",
  "wav",
  "weba",
  "webm",
  "wma",
]);

const GENERIC_PREFIX_PHRASES: readonly (readonly string[])[] = [
  ["phone", "call", "with"],
  ["whatsapp", "voice", "note"],
  ["audio", "recording"],
  ["voice", "recording"],
  ["incoming", "call"],
  ["outgoing", "call"],
  ["missed", "call"],
  ["voice", "note"],
  ["call", "with"],
  ["call", "to"],
  ["conversation", "with"],
  ["meeting", "with"],
  ["interview", "with"],
];

const GENERIC_WORDS = new Set([
  "audio",
  "call",
  "clip",
  "conversation",
  "converted",
  "copy",
  "edited",
  "file",
  "final",
  "incoming",
  "interview",
  "meeting",
  "mobile",
  "new",
  "note",
  "outgoing",
  "phone",
  "rec",
  "record",
  "recording",
  "sound",
  "test",
  "trimmed",
  "unnamed",
  "unknown",
  "video",
  "voice",
  "voicemail",
  "voicenote",
  "whatsapp",
]);

const MONTHS = new Set([
  "jan",
  "january",
  "feb",
  "february",
  "mar",
  "march",
  "apr",
  "april",
  "may",
  "jun",
  "june",
  "jul",
  "july",
  "aug",
  "august",
  "sep",
  "sept",
  "september",
  "oct",
  "october",
  "nov",
  "november",
  "dec",
  "december",
]);

const WEEKDAYS = new Set([
  "mon",
  "monday",
  "tue",
  "tues",
  "tuesday",
  "wed",
  "wednesday",
  "thu",
  "thur",
  "thurs",
  "thursday",
  "fri",
  "friday",
  "sat",
  "saturday",
  "sun",
  "sunday",
]);

const TIME_MARKERS = new Set(["am", "pm", "noon", "midnight"]);

const DATE_CONNECTORS = new Set(["at", "on", "hr", "hrs", "min", "mins", "sec", "secs"]);

const MAX_NAME_TOKENS = 4;
const MAX_NAME_LENGTH = 60;

function missingResult(
  originalFilename: string,
  reason: InferredContactReason,
): InferredContact {
  return {
    name: null,
    confidence: "low",
    source: "filename",
    originalFilename,
    reason,
  };
}

function basenameOf(filename: string): string {
  const parts = filename.split(/[\\/]/u);
  return parts[parts.length - 1] ?? "";
}

function stripFileExtension(filename: string): string {
  let result = filename;
  let isFirstExtension = true;

  while (isFirstExtension) {
    isFirstExtension = false;

    const dotIndex = result.lastIndexOf(".");
    if (dotIndex < 0) {
      break;
    }

    const extension = result.slice(dotIndex + 1);
    if (!extension) {
      break;
    }

    if (AUDIO_EXTENSIONS.has(extension.toLowerCase())) {
      result = result.slice(0, dotIndex);
      isFirstExtension = true;
      continue;
    }

    // Also discard a short, extension-like suffix so unknown formats do not
    // become part of the inferred name. Longer dotted segments are left alone
    // because they are more likely to be parts of a name.
    if (/^[\p{L}\p{N}]{2,5}$/u.test(extension)) {
      result = result.slice(0, dotIndex);
    }
  }

  return result;
}

function tokenize(filename: string): FilenameToken[] {
  const matches = filename.match(
    /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu,
  );
  if (!matches) {
    return [];
  }

  return matches.map((text) => ({
    text,
    lower: text.toLowerCase(),
    hasDigit: /\p{N}/u.test(text),
  }));
}

function startsWithPhrase(
  tokens: FilenameToken[],
  phrase: readonly string[],
): boolean {
  return (
    tokens.length >= phrase.length &&
    phrase.every((word, index) => tokens[index]?.lower === word)
  );
}

function stripGenericEdges(tokens: FilenameToken[]): {
  tokens: FilenameToken[];
  strippedPrefix: boolean;
} {
  let remaining = tokens;
  let strippedPrefix = false;

  // Repeat because removing one generic phrase can expose another prefix.
  let changed = true;
  while (changed) {
    changed = false;

    for (const phrase of GENERIC_PREFIX_PHRASES) {
      if (startsWithPhrase(remaining, phrase)) {
        remaining = remaining.slice(phrase.length);
        strippedPrefix = true;
        changed = true;
        break;
      }
    }

    if (
      !changed &&
      remaining.length > 0 &&
      GENERIC_WORDS.has(remaining[0].lower)
    ) {
      remaining = remaining.slice(1);
      strippedPrefix = true;
      changed = true;
    }
  }

  while (
    remaining.length > 0 &&
    GENERIC_WORDS.has(remaining[remaining.length - 1].lower)
  ) {
    remaining = remaining.slice(0, -1);
  }

  return { tokens: remaining, strippedPrefix };
}

function removeDateAndTimeMetadata(tokens: FilenameToken[]): {
  tokens: FilenameToken[];
  sawNumeric: boolean;
  sawDate: boolean;
  dateSuffix: boolean;
} {
  const removed = new Array<boolean>(tokens.length).fill(false);
  let sawNumeric = false;
  let sawDate = false;

  tokens.forEach((token, index) => {
    if (token.hasDigit) {
      removed[index] = true;
      sawNumeric = true;
      sawDate = true;
    }
  });

  const hasNumericNeighbour = (index: number): boolean =>
    (index > 0 && tokens[index - 1].hasDigit) ||
    (index < tokens.length - 1 && tokens[index + 1].hasDigit);

  tokens.forEach((token, index) => {
    if (MONTHS.has(token.lower)) {
      if (
        index === tokens.length - 1 ||
        hasNumericNeighbour(index)
      ) {
        removed[index] = true;
        sawDate = true;
      }
    }

    if (WEEKDAYS.has(token.lower)) {
      if (
        index === 0 ||
        index === tokens.length - 1 ||
        hasNumericNeighbour(index)
      ) {
        removed[index] = true;
        sawDate = true;
      }
    }

    if (TIME_MARKERS.has(token.lower)) {
      removed[index] = true;
      sawDate = true;
    }
  });

  // Remove connectors only when they are attached to a date/time token, so a
  // short name is not lost merely because it matches a connector.
  tokens.forEach((token, index) => {
    if (!DATE_CONNECTORS.has(token.lower)) {
      return;
    }

    const previousRemoved = index > 0 && removed[index - 1];
    const nextRemoved = index < tokens.length - 1 && removed[index + 1];

    if (previousRemoved || nextRemoved) {
      removed[index] = true;
      sawDate = true;
    }
  });

  const remaining = tokens.filter((_, index) => !removed[index]);
  const lastRemainingIndex = tokens.reduce(
    (lastIndex, _, index) => (removed[index] ? lastIndex : index),
    -1,
  );
  const dateSuffix = removed.some(
    (isRemoved, index) => isRemoved && index > lastRemainingIndex,
  );

  return {
    tokens: remaining,
    sawNumeric,
    sawDate,
    dateSuffix,
  };
}

function isOnlyDateOrGeneric(tokens: FilenameToken[]): boolean {
  return tokens.every(
    (token) =>
      MONTHS.has(token.lower) ||
      WEEKDAYS.has(token.lower) ||
      TIME_MARKERS.has(token.lower),
  );
}

/**
 * Suggests a possible contact name from a recording filename.
 *
 * This is intentionally conservative: it only returns a name when a
 * plausible human-name fragment remains after removing paths, extensions,
 * generic recording words, dates, times and numeric identifiers. A filename
 * is never proof of identity, so confidence is never higher than "medium".
 */
export function inferContactFromFilename(
  originalFilename: string,
): InferredContact {
  const normalized = originalFilename.normalize("NFKC").trim();
  if (!normalized) {
    return missingResult(originalFilename, "generic_only");
  }

  const basename = basenameOf(normalized);
  if (!basename) {
    return missingResult(originalFilename, "generic_only");
  }

  const withoutExtension = stripFileExtension(basename);
  const rawTokens = tokenize(withoutExtension);
  if (rawTokens.length === 0) {
    return missingResult(originalFilename, "generic_only");
  }

  const genericStripped = stripGenericEdges(rawTokens);
  const dateStripped = removeDateAndTimeMetadata(genericStripped.tokens);
  const finalGenericStripped = stripGenericEdges(dateStripped.tokens);

  const candidate = finalGenericStripped.tokens;
  const sawGeneric =
    genericStripped.strippedPrefix || finalGenericStripped.strippedPrefix;
  const sawNumeric = dateStripped.sawNumeric;
  const sawDate = dateStripped.sawDate;

  if (candidate.length === 0 || isOnlyDateOrGeneric(candidate)) {
    return missingResult(
      originalFilename,
      sawNumeric ? "phone_or_numeric_only" : "generic_only",
    );
  }

  const name = candidate.map((token) => token.text).join(" ");
  if (candidate.length > MAX_NAME_TOKENS || name.length > MAX_NAME_LENGTH) {
    return missingResult(
      originalFilename,
      sawNumeric ? "phone_or_numeric_only" : "generic_only",
    );
  }

  const hasLetter = /\p{L}/u.test(name);
  if (!hasLetter) {
    return missingResult(originalFilename, "phone_or_numeric_only");
  }

  let confidence: InferredContactConfidence = "medium";
  if (
    candidate.some(
      (token) =>
        token.text.length === 1 ||
        GENERIC_WORDS.has(token.lower) ||
        MONTHS.has(token.lower) ||
        WEEKDAYS.has(token.lower),
    )
  ) {
    confidence = "low";
  }

  let reason: InferredContactReason = "name_only";
  if (sawGeneric) {
    reason = "name_after_generic_prefix";
  } else if (sawDate && dateStripped.dateSuffix) {
    reason = "name_with_date_suffix";
  }

  return {
    name,
    confidence,
    source: "filename",
    originalFilename,
    reason,
  };
}
