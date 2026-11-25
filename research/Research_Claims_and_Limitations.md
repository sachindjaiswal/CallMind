# Research Claims and Limitations — Evidence Ledger

This ledger maps every substantive claim in `CallMind_Research_Paper.tex` to its source.
It is intended for the project owner, the guide, and any reviewer who wants to check the
paper against the repository and the experimental log.

**Legend for status**

- **V** — verified by direct source inspection and/or reproducible execution.
- **O** — observed in the persisted dataset (read-only).
- **L** — supported by the reviewed literature.
- **Q** — qualified/partial; described with an explicit caveat in the paper.
- **P** — proposed/future work; not claimed as implemented.

For clarity: **implemented/tested** claims are marked V, **observed** claims O,
**literature-supported** claims L, **qualified** claims Q, and **future/proposed** claims P.
A claim can be implemented/tested without being empirically demonstrated on the persisted
corpus; the distinction is explicit in the status column.

**Audit date:** 25 November 2026. **Implementation frozen at:** Phase 3G-B (per the project
owner's brief); Phase 3G-C was not started.

---

## 1. System and implementation claims

| # | Claim in the manuscript | Status | Evidence |
|---|---|---|---|
| C1 | The system accepts multiple audio files in one request and returns a per-file result (`created`, `duplicate`, `rejected`) so one bad file does not block a batch. | V | `apps/api/src/routes/recordings.ts` (upload handler, per-file loop, summary); `packages/shared/src/schemas/recordings.ts` (`uploadFileResultSchema`). |
| C2 | Upload validation checks extension allow-list, non-empty size, 25 MiB limit, ASF/WMA signature, and detected MIME against the extension. | V | `apps/api/src/services/audioValidation.ts`; `packages/shared/src/constants/recordings.ts` (`SUPPORTED_AUDIO_EXTENSIONS`, `AUDIO_MIME_BY_EXTENSION`). |
| C3 | Duplicate detection uses a SHA-256 checksum scoped to the workspace and is enforced by a unique index. | V | `apps/api/src/lib/checksum.ts`; `apps/api/src/services/recordingService.ts`; `packages/db/src/recording.ts` (`recording_workspace_checksum_unique` equivalent unique index). |
| C4 | Original audio files are stored immutably under a workspace-scoped storage key; uploads are moved from a temp directory. | V | `apps/api/src/lib/storage.ts`; `recordingService.ts` (`moveIntoStorage`); README ("Uploaded audio is never modified"). |
| C5 | Background work uses Redis + BullMQ with four queues: prepare, transcribe, analyze, daily-report. | V | `packages/shared/src/constants/queues.ts`; `apps/api/src/lib/recordingQueue.ts`; `apps/api/src/lib/dailyReportQueue.ts`; `apps/worker/src/index.ts`. |
| C6 | Jobs use entity IDs as job IDs, bounded exponential retries, and atomic status claims to avoid double processing. | V | `recordingQueue.ts` / `dailyReportQueue.ts`; `apps/worker/src/queues/*.ts` (`findOneAndUpdate` claims, `UnrecoverableError`). |
| C7 | Language routing sends explicit English (`en`) to Groq `whisper-large-v3-turbo`; `auto` and `hi` go to Gemini `gemini-3.5-transcribe` with diarization and word timestamps. | V | `apps/worker/src/lib/stt.ts` (`resolveSttProvider`); `apps/worker/src/lib/geminiTranscription.ts` (`diarization: true`, `wordTimestamp: true`); `groqTranscription.ts`; `docker-compose.yml` defaults. |
| C8 | Gemini transcription transcodes unsupported containers to a temporary 16 kHz mono WAV via FFmpeg and deletes the temporary directory. | V | `apps/worker/src/lib/geminiTranscription.ts` (`convertToWav`, `finally` cleanup). |
| C9 | Analysis uses Gemini structured output (`responseMimeType: application/json`, `responseSchema`, temperature 0.2, 120 s timeout) with a primary and fallback model. | V | `apps/worker/src/lib/geminiAnalysis.ts`; `packages/shared/src/schemas/analysis.ts` (`geminiAnalysisResponseSchema`); `apps/worker/src/config/env.ts`. |
| C10 | The extraction schema defines 11 categories: topic, person, task, date, decision, commitment, transaction, project, risk, question, insight. | V | `packages/shared/src/schemas/analysis.ts` (`INSIGHT_CATEGORIES`). |
| C11 | Each insight carries a typed `evidence` object with recording id, segment id/index, start, end, and quote. | V | `analysisEvidenceSchema` in `packages/shared/src/schemas/analysis.ts`. |
| C12 | Evidence validation requires a matching recording, an existing segment, id/index agreement, timing within 0.25 s, and quote containment after whitespace normalization. | V | `apps/worker/src/lib/conversationAnalysis.ts` (`validateEvidence`, `validateAnalysisAgainstTranscript`). |
| C13 | Insights that fail evidence validation are rejected rather than persisted; empty or content-free insights are dropped. | V | `conversationAnalysis.ts` (`AnalysisValidationError`, content-field filter); `apps/worker/src/queues/recordingAnalyze.ts` (error path). |
| C14 | Cross-recording consolidation is deterministic (`system` / `deterministic-v1`) and does not call an LLM. | V | `apps/worker/src/lib/reportConsolidation.ts`; `packages/shared/src/constants/dailyReports.ts` (`DAILY_REPORT_GENERATION_VERSION = "deterministic-v1"`). |
| C15 | Consolidation groups by category and normalized entity/subject key, preserves `sourceInsightIds`, `sourceRecordingIds`, and evidence, and re-validates every evidence item against the source transcript. | V | `reportConsolidation.ts` (`buildInsights`, `validateConsolidationResult`, `validateEvidenceAgainstTranscript`). |
| C16 | Relationship types are `shared_entity`, `shared_topic`, `task_update`, `deadline_revision`, `value_revision`; relationships are marked `pending` and explicitly proposed, not confirmed. | V | `packages/shared/src/constants/dailyReports.ts`; `reportConsolidation.ts` (`addRelationship`, `reviewStatus: "pending"`); README. |
| C17 | Conflict types are `status_conflict`, `date_conflict`, `quantity_conflict`; conflicts start `unresolved` and can be `resolved` or `dismissed` without deleting original values. | V | `packages/shared/src/constants/dailyReports.ts`; `reportConsolidation.ts`; `apps/api/src/services/dailyReportService.ts` (`updateConflict`). |
| C18 | Report generation accepts explicit recording IDs, a `YYYY-MM-DD` date and an IANA timezone; only `analysis_completed` recordings with valid transcripts/analyses inside the local date are eligible. | V | `packages/shared/src/validation/reportSources.ts`; `dailyReportService.ts`; `packages/shared/src/utils/datetime.ts` (`isInstantInReportDate`). |
| C19 | Identical generation requests are rejected as duplicates; regeneration creates a new version linked by `previousReportId`. | V | `dailyReportService.ts` (`requestFingerprint`, `REPORT_DUPLICATE_REQUEST`, `regenerate`). |
| C20 | The dashboard is read-only and report-driven; it renders one card per source recording and only the non-empty category sections. | V | `apps/web/src/pages/dashboard.tsx`; `apps/web/src/components/dashboard/recording-card.tsx`; `apps/web/src/lib/recording-dashboard.ts` (`RECORDING_SECTIONS`, `groupRecordingInsights`). |
| C21 | The dashboard supports browser-local date/timezone defaults, report-version selection, 2 s polling for active reports, and evidence navigation to `/recordings?recordingId=&segmentId=&segmentIndex=&start=`. | V | `apps/web/src/hooks/use-dashboard-report.ts`; `dashboard.tsx` (`handleOpenSourceRecording`); `apps/web/src/lib/recording-deep-link.ts`; `evidence-drawer.tsx`. |
| C22 | The stack is MERN + TypeScript with React 18/Vite/Tailwind/shadcn-compatible components, Express, BullMQ/Redis, MongoDB/Mongoose, and Docker Compose. | V | `README.md` stack table; `package.json` files; `docker-compose.yml`; `docker/Dockerfile`. |
| C23 | Authentication and cloud object storage are not implemented by design. | V | `README.md` "Scope" section. |
| C24 | Direct provider APIs are used; there is no API-routing intermediary. | V | `README.md` ("Only direct provider APIs are used"); worker adapters call `generativelanguage.googleapis.com` and `api.groq.com` directly. |
| C25 | Report-date eligibility uses the recording creation timestamp and the requested IANA timezone; the conversation date is not independently inferred or validated. | V | `reportSources.ts`; `dailyReportService.ts`; `datetime.ts`. |
| C26 | Selected rule-based conflict detection covers status, date, and quantity disagreements; no claim is made about all contradiction types. | V | `dailyReports.ts` constants; `reportConsolidation.ts`. |

---

## 2. Empirical claims (this audit)

| # | Claim in the manuscript | Status | Evidence |
|---|---|---|---|
| E1 | `npm run typecheck` passes. | V | Experiment log §2.1; command exit 0. |
| E2 | `npm run build` passes. | V | Experiment log §2.2; command exit 0. |
| E3 | Offline tests: 30 files, 175 tests, 170 passed, 5 failed. | V | Experiment log §3; per-workspace runs. |
| E4 | The 5 failures are date-sensitive daily-report fixtures, not live-product regressions observed here. | V | Experiment log §3.1; failure messages and root cause in `reportSources.ts`; README/journal prior record. |
| E5 | Persisted corpus: 8 recordings, 6 completed analyses, 5 completed reports. | O | Experiment log §4.1; read-only `countDocuments`. |
| E6 | Transcript providers: 6 Groq, 1 Gemini; languages English 5, Hindi 1, `hi` 1. | O | Experiment log §4.2. |
| E7 | All 6 analyses used `gemini-3.1-flash-lite` with `fallbackUsed = true` and attempted `gemini-3.8-flash` first. | O | Experiment log §4.3. |
| E8 | 6 insights total across 6 analyses; categories `insight` 5, `date` 1; explicitness `explicit` 6, `inferred` 0. | O | Experiment log §4.4. |
| E9 | Evidence audit: 6/6 insights resolved to a segment, 6/6 quote containment, 6/6 timing within 0.25 s. | O | Experiment log §4.5. |
| E10 | Reports: 5 completed; 9 consolidated insights; 9/9 consolidated evidence items re-validated; 0 relationships; 0 conflicts; 1 regenerated version. | O | Experiment log §4.6. |
| E11 | The sample is too small and lacks ground truth for WER/CER/precision/recall/F1. | V | No reference transcripts or annotations exist; Experiment log §6. |
| E12 | The `0 relationships / 0 conflicts` observation does not establish relationship/conflict accuracy. | Q | Small sample; conservative design; no ground truth. |
| E13 | Evidence validation checks quote containment and timing, not semantic entailment; 6/6 and 9/9 are provenance-consistency results, not accuracy. | Q | `conversationAnalysis.ts`; Experiment log §4.5–4.6 and §6. |
| E14 | No relationships and no conflicts were persisted in the audited reports; those paths are supported by tests/inspection only. | O/Q | Experiment log §4.6. |

---

## 3. Literature claims

| # | Claim in the manuscript | Status | Evidence |
|---|---|---|---|
| L1 | Abstractive meeting summarization is a mature but still difficult task with long, multi-party inputs and evaluation challenges. | L | Rennard et al. [P1], abstract and scope. |
| L2 | QMSum contributes 1,808 query–summary pairs over 232 meetings and shows long meeting summarization remains challenging. | L | Zhong et al. [P2], abstract. |
| L3 | Action-item rephrasing from transcripts is harder than the analogous email task and benefits from extra context; BART/UniLM baselines approach human quality on a constrained subset. | L | Cohen et al. [P3], abstract and PDF. |
| L4 | Action-item detection benefits from local+global context (Context-Drop) and lightweight ensembling; annotated action-item data is scarce. | L | Liu et al. [P4], abstract. |
| L5 | Action-item-driven recursive summarization achieved BERTScore 64.98 on AMI, about 4.98% above a fine-tuned BART baseline. | L | Golia & Kalita [P5], abstract. |
| L6 | Multi-session dialogue requires explicit temporal and relational structure; Conversation Chronicles provides a 1M multi-session dataset and ReBot (~630M parameters). | L | Jang et al. [P6], abstract. |
| L7 | Very long-term dialogue (LoCoMo: ~600 turns, ~16K tokens, up to 32 sessions) remains difficult for LLMs; long-context and RAG help but do not solve it. | L | Maharana et al. [P7], abstract. |
| L8 | Source-grounded information-seeking over long meeting transcripts benefits from human-verified attribution; fine-tuning on MISeD improves attribution while reducing effort. | L | Golany et al. [P8], abstract. |
| L9 | Whisper is a large-scale weakly supervised ASR model relevant to the transcription stage. | L | Radford et al. [P9], PMLR record. |
| L10 | Within the selected literature, we did not find an end-to-end system combining per-recording evidence-linked extraction with cautious cross-recording daily-report consolidation. | L/Q | Literature matrix §4. Phrased as a scoped finding, not a universal "no system exists" claim. |

---

## 4. Explicit limitations disclosed in the manuscript

| # | Limitation | Why it matters |
|---|---|---|
| X1 | Small, short, smoke-test corpus (8 recordings; 6 analyses; 1.7–44 s). | No generalizable accuracy estimate. |
| X2 | No reference transcripts or human annotations. | WER/CER and precision/recall/F1 cannot be computed. |
| X3 | Extraction coverage is low (6 insights across 6 analyses; one analysis produced zero). | The prototype demonstrates the contract, not extraction quality. |
| X4 | Five of six insights use the generic `insight` category; only one typed `date` insight was observed. | Category-specific extraction is not empirically demonstrated. |
| X5 | All persisted analyses used the fallback model. | Primary-model behaviour is not characterised in this snapshot. |
| X6 | No relationships or conflicts were observed in persisted reports. | Those code paths are verified by tests/inspection, not by real data. |
| X7 | Consolidation uses exact normalized matching, not fuzzy entity resolution. | Similar names/entities are deliberately not merged; recall is limited. |
| X8 | No quantitative baseline against transcript-only or per-recording-summary workflows. | Only a qualitative capability comparison is possible. |
| X9 | Five date-sensitive tests fail on dates other than 2026-11-21. | Root test suite is not currently green; fixture fix is out of scope. |
| X10 | No authentication, no multi-tenant isolation beyond a workspace string, no cloud object storage. | Deployment/security evaluation is out of scope. |
| X11 | Evidence validation checks quote containment and timing, not semantic entailment. | A quote can support a claim weakly or be contextually misleading; the contract is necessary but not sufficient. |
| X12 | ASR errors propagate into extraction. | The system does not correct upstream transcription errors. |
| X13 | Timezone/date scoping uses recording `createdAt`, not conversation date. | A recording uploaded on a different day than the conversation is excluded/mis-scoped. |

---

## 5. Claims deliberately **not** made

- CallMind is not described as "the first", "world's first", "completely novel", or as a
  system for which "no existing solution" exists.
- No precision, recall, F1, WER, CER, accuracy, or confidence-calibration number is
  reported.
- LLM confidence values are not presented as accuracy.
- Unit-test pass counts are not presented as NLP accuracy.
- Planned features are not described as implemented.
- No customer names, phone numbers, filenames, transcript text, MongoDB IDs, or API keys
  appear in the manuscript.
