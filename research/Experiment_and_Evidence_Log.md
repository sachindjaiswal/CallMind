# Experiment and Evidence Log — CallMind Intelligence

**Purpose:** Record every empirical observation used in the manuscript, with the exact
command, date, scope, result, and interpretation. This log distinguishes functional
verification from model-performance evaluation. No live Groq/Gemini inference, no new
transcription, no production BullMQ trigger, and no database writes were performed.

**Evidence collection date:** 25 November 2026 (UTC)
**Repository:** `/home/sachindjaiswal/newStudent/callMind`
**Git state:** branch `main`, commit `d16d3c5` ("Initial commit: CallMind Intelligence"),
working tree clean at the start of the audit.
**Runtime:** Node `v24.15.0`, npm `11.12.1`, Docker `29.5.2`, Docker Compose `v5.1.4`.

> **Development boundary observed.** The implementation was treated as frozen. No prompts,
> schemas, providers, models, application code, tests, persisted recordings, transcripts,
> analyses, reports, or containers were modified. The running stack was inspected read-only.

---

## 1. Environment and service snapshot (read-only)

### 1.1 Docker services

Command:

```bash
docker compose ps
```

Observed services: `callmind-api` (healthy), `callmind-mongo` (healthy),
`callmind-redis` (healthy), `callmind-worker` (up), `callmind-web` (up).
Unrelated projects (ClassEase, SAHER) were left untouched.

### 1.2 API health

Command:

```bash
curl -s http://127.0.0.1:8080/api/health
```

Observed (2026-11-25T10:20:26Z): `status: "ok"`, API `up`, MongoDB `up` (2 ms),
Redis `up` (2 ms).

### 1.3 Upload configuration

Command:

```bash
curl -s http://127.0.0.1:8080/api/recordings/config
```

Observed: `maxFileSizeBytes = 26214400` (25 MiB), `maxFilesPerUpload = 20`,
extensions `mp3, wav, m4a, mp4, ogg, oga, flac, webm, weba`, language hints
`auto, en, hi`.

---

## 2. Static verification (offline, reproducible)

### 2.1 TypeScript typecheck

Command:

```bash
npm run typecheck
```

Result: **PASS** (exit 0). Builds `@callmind/shared` and `@callmind/db`, then typechecks
`db`, `api`, `worker`, and `web`.

### 2.2 Production build

Command:

```bash
npm run build
```

Result: **PASS** (exit 0). Vite produced a production bundle
(`dist/assets/index-*.js`, 397.84 kB, gzip 121.04 kB). Rollup emitted two non-fatal
comments about annotations in `zod`; no build error.

### 2.3 Manuscript and figure build

Commands (TinyTeX; `courier` installed for `\texttt` under T1):

```bash
export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$PATH"
cd research
pdflatex -interaction=nonstopmode -halt-on-error CallMind_Research_Paper.tex
bibtex CallMind_Research_Paper
pdflatex -interaction=nonstopmode -halt-on-error CallMind_Research_Paper.tex
pdflatex -interaction=nonstopmode -halt-on-error CallMind_Research_Paper.tex
```

Result: **PASS**, 8 pages (A4), 0 overfull boxes, 9 references resolved.
`research/figures/architecture.pdf` and `research/figures/provenance.pdf` were rebuilt
from their TikZ sources and visually checked for legibility at the widths used in the
paper.

---

## 3. Offline test execution

Tests use `mongodb-memory-server` and mocked provider responses where a live API call is
not required. They do **not** call Groq or Gemini and do **not** touch the production
queue or persisted data.

Commands (run per workspace to obtain independent counts):

```bash
npm run test -w @callmind/shared
npm run test -w @callmind/db
npm run test -w @callmind/api
npm run test -w @callmind/worker
npm run test -w @callmind/web
```

| Workspace | Test files | Passed | Failed | Exit |
|---|---:|---:|---:|---:|
| `@callmind/shared` | 5 | 21 | 0 | 0 |
| `@callmind/db` | 1 | 5 | 0 | 0 |
| `@callmind/api` | 4 | 29 | 3 | 1 |
| `@callmind/worker` | 11 | 44 | 2 | 1 |
| `@callmind/web` | 9 | 71 | 0 | 0 |
| **Total** | **30** | **170** | **5** | — |

### 3.1 Failing tests and root cause

All five failures are in the daily-report API/worker suites and are **date-sensitive
fixtures**, not product regressions observed in this audit:

- `apps/api/src/__tests__/dailyReports.test.ts` — 3 failures:
  - "queues a report for explicit sources and prevents duplicate requests" — expected
    HTTP `202`, received `400`.
  - "rejects incomplete sources" — expected `ANALYSIS_NOT_COMPLETED`, received
    `RECORDING_OUTSIDE_REPORT_DATE`.
  - "lists reports and regenerates a new version" — expected total `1`, received `0`.
- `apps/worker/src/__tests__/dailyReportProcessor.test.ts` — 2 failures:
  - "generates a report once and skips duplicate jobs" — `UnrecoverableError: Recording
    ... is outside the selected reporting date and timezone.`
  - "fails permanently for an incomplete source" — expected `ANALYSIS_NOT_COMPLETED`,
    received `RECORDING_OUTSIDE_REPORT_DATE`.

**Root cause:** the fixtures create recordings without an explicit `createdAt` (so they
default to the current date, 2026-11-25) while hardcoding `reportDate: "2026-11-21"`.
Source validation compares `recording.createdAt` against the report date/timezone in
`packages/shared/src/validation/reportSources.ts` (the `isInstantInReportDate` check).
This matches the limitation already documented in `PROJECT_JOURNAL.md` and `README.md`
(2026-11-22). The fixtures were **not** modified, because the audit must not manufacture
passing results.

**Interpretation:** the suite demonstrates functional coverage of the daily-report path,
but the `api` and `worker` suites currently exit non-zero because of these fixtures. The
manuscript reports this honestly and does not use test counts as an NLP-accuracy metric.

---

## 4. Persisted-data audit (read-only)

All queries were executed with `mongosh` inside the existing `callmind-mongo` container
using read-only `find`/`aggregate`/`countDocuments`. No writes were issued. Raw identifiers,
filenames, phone numbers, names, and transcript text are deliberately **not** reproduced
here or in the manuscript.

### 4.1 Corpus size and status

| Quantity | Observed |
|---|---:|
| Recordings | 8 |
| Recordings with `analysis_completed` | 6 |
| Recordings with transcript but no completed analysis (`transcribed`) | 1 |
| Recordings prepared but not transcribed (`ready_for_transcription`) | 1 |
| Completed conversation analyses | 6 |
| Daily reports | 5 (all `completed`) |

### 4.2 Transcription providers and languages

| Transcript provider | Count |
|---|---:|
| Groq (`whisper-large-v3-turbo`) | 6 |
| Gemini (`gemini-3.5-transcribe`) | 1 |

| Transcript language value | Count |
|---|---:|
| `English` | 5 |
| `Hindi` | 1 |
| `hi` | 1 |

Observed transcript segments per recording ranged from 1 to 8; audio durations ranged
from 1.7 s to about 44 s. These are short smoke-test recordings, not a benchmark corpus.

### 4.3 Analysis provider and model behaviour

All 6 completed analyses used provider `gemini` and model `gemini-3.1-flash-lite`, with
`fallbackUsed = true` and `attemptedModels = ["gemini-3.8-flash",
"gemini-3.1-flash-lite"]`. The observed data therefore show that, in this snapshot, the
primary model did not produce the persisted result and the fallback model did.

This is a factual observation about the stored records; the audit did **not** re-run the
primary model or investigate the provider-side cause.

### 4.4 Extracted insights

| Quantity | Observed |
|---|---:|
| Total insights across 6 analyses | 6 |
| Insights per analysis | 0, 0, 1, 1, 2, 2 |
| Category `insight` | 5 |
| Category `date` | 1 |
| Explicitness `explicit` | 6 |
| Explicitness `inferred` | 0 |
| Confidence `high` | 1 |
| Confidence `null` | 5 |
| Insights with an evidence object | 6 |

**Interpretation:** extraction coverage is low on this small, short-recording sample. One
analysis produced zero insights, and five of six insights fell back to the generic
`insight` category rather than a more specific typed category. This is reported as a
limitation; it is not evidence of a general extraction-accuracy rate.

### 4.5 Evidence-traceability audit (per-recording analyses)

A read-only script re-checked each stored insight against the stored transcript using the
same rules as the implementation: resolve the segment by id or index, require quote
containment after whitespace normalization, and require start/end within 0.25 s of the
segment.

| Check | Result |
|---|---:|
| Insights checked | 6 |
| Segment resolved | 6 / 6 |
| Quote contained in segment | 6 / 6 |
| Timing within ±0.25 s | 6 / 6 |
| All checks passed | 6 / 6 |

**Interpretation:** on the persisted sample, every stored insight is traceable to a real
transcript segment. This measures the internal consistency of the evidence contract, not
whether the extracted insight is semantically correct. The audit re-applied the
implementation's rules; it was not an independent human evaluation, and quote containment
plus timing do not establish semantic entailment.

### 4.6 Daily-report audit

| Quantity | Observed |
|---|---:|
| Completed reports | 5 |
| Reports in `UTC` | 2 |
| Reports in `Asia/Kolkata` | 3 |
| Source-recording links across reports | 7 |
| Consolidated insights across reports | 9 |
| Consolidated category `insight` | 9 |
| Proposed relationships | 0 |
| Conflicts | 0 |
| Reports with `previousReportId` (regeneration lineage) | 1 |
| Consolidated evidence items | 9 |
| Consolidated evidence items that re-validated | 9 / 9 |

Report sizes were: two reports with 2 source recordings and 3 consolidated insights each;
one report with 1 source and 2 insights; one with 1 source and 1 insight; one with 1 source
and 0 insights.

**Interpretation:** the deterministic consolidation path produced valid, re-validated
evidence for every consolidated insight in the sample, which is a provenance-consistency
result, not an independent semantic evaluation. However, the sample exercised no
relationships and no conflicts, so the manuscript cannot claim empirical performance for
those paths. Selected rule-based conflict detection covers status, date, and quantity
disagreements; the paths are verified only by unit tests and code inspection, and no claim
is made about all contradiction types.

---

## 5. What was deliberately **not** done

- No live Gemini analysis call.
- No live Groq or Gemini transcription call.
- No re-transcription of existing recordings.
- No production BullMQ job was enqueued or triggered.
- No prompt, schema, provider, model, or application-code change.
- No write to MongoDB (no inserts, updates, deletes, or index changes).
- No Docker restart, rebuild, or teardown.
- No commit or push.
- No secret, `.env` value, API key, token, or credential was read or printed.

---

## 6. Reproducibility notes and limitations

- The persisted corpus is a smoke-test set (8 short recordings, 6 completed analyses).
  It is suitable for functional and provenance verification, not for estimating WER, CER,
  precision, recall, or F1.
- No reference transcripts or human relevance judgements were available, so no ASR or
  extraction accuracy metric is computed. The manuscript states this explicitly.
- The 5 failing tests are date-sensitive and reproducible only on a date other than
  2026-11-21. They should be fixed by pinning fixture timestamps; the fix is intentionally
  out of scope for this research-documentation task.
- The `0 relationships / 0 conflicts` result may reflect both the small sample and the
  conservative consolidation design. It cannot be used to estimate false-positive or
  false-negative relationship rates.
