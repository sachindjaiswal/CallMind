# Project journal

## 2026-11-21 — Phase 3A.3 evaluation synthesis

- Compared transcription architectures against real CallMind recordings and the
  remaining quota/availability constraints.
- Confirmed Gemini 3.8 Flash was unreliable for live analysis use and recommended
  preserving the 3.1 Flash Lite fallback for conversation analysis.
- Recommended Strategy C: Gemini-first auto/Hindi transcription, Groq Whisper for
  explicit English, and no OmniRoute/provider abstraction layer.

## 2026-11-21 — Approved STT architecture implemented

- Added `languageHint` to shared schemas, API upload handling, DB recording records
  and the recording upload UI.
- Worker routes `auto` and `hi` to Gemini `gemini-3.5-transcribe` with diarization
  and word timestamps; `en` remains on Groq `whisper-large-v3-turbo`.
- Gemini transcription transcodes unsupported containers through temporary files
  only; original audio and storage keys are unchanged.
- Verified typecheck, tests, production build, Docker config and targeted rebuild.
- Live smoke recordings passed with `6b01ce018afb754f097366a2` (auto Hindi via
  Gemini, labelled speakers) and `6b01ce018afb754f097366a7` (English via Groq).

## 2026-11-21 — Phase 3C Part B: Step 0 verification

- Verified services were healthy: API, worker, web, MongoDB and Redis.
- Verified target recordings `6b01be77d2324d50d6829b9e` and
  `6b01be7bd2324d50d6829ba3` exist, are completed, and have accessible analyses.
- Confirmed both target recordings belong to workspace `default` and share
  `2026-11-21` as their reporting date under UTC and `Asia/Kolkata`.
- Recorded that the first target still has the earlier Groq English transcript and
  New York City insight; it must be treated as a source limitation, not corrected
  by the report layer.

## 2026-11-21 — Phase 3C Part B: implementation

- Added `DailyReport` model with workspace/report/date indexes, unique request
  fingerprints, regeneration lineage and mixed generic insight/relationship/conflict
  payloads preserved separately from source data.
- Added shared DTOs, date/timezone validation, source validation and queue constants.
- Implemented deterministic cross-recording consolidation that groups exact
  normalized subjects, proposes conservative relationships, detects status/date/
  quantity conflicts, preserves provenance, and rejects fabricated evidence.
- Added a dedicated BullMQ queue/worker with bounded retries, atomic claims,
  idempotent completion, non-retryable source/evidence errors and failed-status
  error metadata.
- Added API endpoints for generate, list, detail, conflicts, conflict review and
  regeneration, with workspace scoping and explicit validation errors.
- Added a Daily Reports UI with a generation form, report history, insight groups,
  evidence drawer, proposed relationships, conflicts, review actions and
  regeneration. No final dashboard was added.

## 2026-11-21 — Phase 3C Part B: verification

- Added unit and integration tests for timezone boundaries, DTO validation, source
  validation, generic grouping, relationships, conflict detection, fabricated
  evidence, queue processing, duplicate requests, regeneration and conflict review.
- `npm run typecheck`, `npm test`, `npm run build` and `docker compose config --quiet`
  pass.
- Live validation generated genuine report `6b01d6cad5b872e4e6b67e3a` for the two
  target recordings using explicit `2026-11-21` / `UTC`. It completed with 3
  consolidated insights, 0 proposed relationships, 0 conflicts, 2 source
  recordings and valid provenance.
- An identical live generation request returned `409 REPORT_DUPLICATE_REQUEST`.
- Live regeneration produced `6b01d6e4d5b872e4e6b67e48`, linked to the original by
  `previousReportId`, and completed with the same 3/0/0 result.
- Source recordings remained `analysis_completed` with unchanged Groq transcripts
  and Gemini `gemini-3.1-flash-lite` analyses (1 and 2 insights respectively).

## 2026-11-22 — Phase 3D-A: dynamic dashboard

- Replaced the static `/` dashboard with a read-only, data-driven daily
  intelligence view backed by `fetchDailyReports` and `fetchDailyReport`.
- Added browser-local date and IANA timezone defaults, exact-date report loading,
  newest-completed report selection, timezone fallback with a selector, and
  historical report-version switching that preserves manual selection during
  refreshes.
- Added two-second polling for queued/generating reports with terminal-status,
  date/timezone and unmount cleanup plus in-flight request guards.
- Added dynamic category rendering in canonical `INSIGHT_CATEGORIES` order,
  including humanized fallbacks for unknown categories, and omitted empty groups.
- Added summary metrics, relationship/conflict sections, and explicit loading,
  no-report, generating, failed, refresh-error and no-insight states.
- Kept generation, regeneration and conflict review in `/daily-reports`.
- Integrated Freebuff's `onOpenSourceRecording` EvidenceDrawer callback with the
  verified `/recordings?recordingId=&segmentId=&segmentIndex=&start=` deep-link
  contract. The dashboard closes the drawer before navigating and does not
  duplicate recording lookup, scrolling or highlighting.
- Files added: `apps/web/src/lib/insight-categories.ts`,
  `apps/web/src/hooks/use-dashboard-report.ts`,
  `apps/web/src/components/dashboard/*`, and dashboard/category tests.
- Files updated: `apps/web/src/pages/dashboard.tsx`,
  `apps/web/src/components/recordings/analysis-panel.tsx` (shared category
  metadata reuse), `README.md`, and this journal.

### Verification

- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run test -w @callmind/web` — 8 files, 33 tests passed.
- Shared tests — 4 files, 18 tests passed.
- DB tests — 1 file, 5 tests passed.
- API tests — 29/32 passed. Failing tests:
  - `daily reports API > queues a report for explicit sources and prevents duplicate requests` — expected `202`, received `400`.
  - `daily reports API > rejects incomplete sources` — expected `ANALYSIS_NOT_COMPLETED`, received `RECORDING_OUTSIDE_REPORT_DATE`.
  - `daily reports API > lists reports and regenerates a new version` — expected total `1`, received `0`.
- Worker tests — 43/45 passed. Failing tests:
  - `daily report processor > generates a report once and skips duplicate jobs` — `UnrecoverableError: Recording <id> is outside the selected reporting date and timezone.`
  - `daily report processor > fails permanently for an incomplete source` — expected `ANALYSIS_NOT_COMPLETED`, received `RECORDING_OUTSIDE_REPORT_DATE`.
- Root cause confirmed: both fixtures create recordings without an explicit
  `createdAt` (defaulting to the current date, `2026-11-22`) while hardcoding
  `reportDate: "2026-11-21"`. Source validation compares `recording.createdAt`
  against the report date/timezone in `packages/shared/src/validation/reportSources.ts:96`.
  This is independent of the web dashboard, which has no API/worker imports.
- Full `npm test` therefore stops at the API suite; the dashboard web suite passes
  independently.

### Known limitations

- The dashboard renders only fields present in the current `DailyReportDto`; it
  does not invent task statuses, amounts, due dates or quantities.
- The API/worker test failures are date-sensitive fixture issues outside the
  dashboard-owned files and were not modified.

## 2026-11-22 — Phase 3E-A: per-recording dashboard cards

- Replaced category-grouped dashboard cards with one unified card per
  `sourceRecordingId`, preserving mixed insights in a single call context.
- Added `recording-dashboard.ts` helpers to derive bullet summaries, rich detail
  lines, section grouping, fallback evidence and human-readable recording
  labels from data already returned by the report/analysis APIs.
- Added `useRecordingDetails` to enrich dashboard cards through the existing
  `fetchRecording` endpoint. No backend, worker, transcription, analysis or
  shared DTO changes were made.
- Added `RecordingCard`, which shows the call summary, topics, metadata,
  explicit/inferred/confidence markers, only non-empty detail sections, and a
  single `View evidence` action per recording. Evidence still opens via
  Freebuff's `EvidenceDrawer` callback and existing
  `/recordings?recordingId=&segmentId=&segmentIndex=&start=` deep link.
- Preserved date, timezone, report-version selection, polling, and
  relationship/conflict sections. Dashboard still falls back to newest
  completed report and available timezone.
- Documented data limitation: `DailyReportDto.sourceRecordings` and
  `ConsolidatedInsight` do not contain structured fields such as assignees, due
  dates, amounts, quantities, roles or severity. The dashboard reads those
  fields from existing `AnalysisDto` data via `fetchRecording` and falls back to
  consolidated report insights if recording details fail.
- Files added: `apps/web/src/lib/recording-dashboard.ts`,
  `apps/web/src/hooks/use-recording-details.ts`,
  `apps/web/src/components/dashboard/recording-card.tsx`.
- Files updated: `apps/web/src/pages/dashboard.tsx`,
  `apps/web/src/pages/dashboard.test.tsx`, `README.md`, and this journal.
- Freebuff-owned evidence drawer, recording deep-link helpers and API client
  were not modified.

### Verification

- `npm run test -w @callmind/web` — 8 files, 37 tests passed.
- `npm run typecheck -w @callmind/web` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- Focused tests added for one rich recording card with bullet summary/evidence
  navigation, multiple recordings in separate cards, omission of empty detail
  sections, consolidated-insight fallback, timezone/version preservation,
  no-report state and API error state.
- Known API/worker date-sensitive fixture failures documented under Phase 3D-A
  remain unchanged and were not modified per owner instruction.
