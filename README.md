# CallMind Intelligence

General-purpose AI-powered conversation intelligence. Upload call recordings,
generate grounded transcripts and structured insights, then consolidate selected
recordings into an explicit daily report with traceable evidence, proposed
relationships, and reviewable conflicts.

This repository implements the full recording pipeline, cross-recording
consolidation, a dedicated Daily Report workspace, and a read-only dynamic
dashboard that renders the intelligence actually present in a selected report.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui-compatible components, React Router |
| Backend | Node.js, Express, TypeScript |
| Worker | BullMQ on Redis |
| Database | MongoDB (Mongoose) |
| Shared | `packages/shared` (Zod schemas, types, constants, validation helpers) |
| Data layer | `packages/db` (Mongoose models and indexes) |
| Infra | Docker, Docker Compose (Node 22 LTS images) |

## Repository layout

```
callMind/
├── apps/
│   ├── api/          Express API (recordings, daily reports, health)
│   ├── worker/       BullMQ workers (prepare, transcribe, analyse, daily report)
│   └── web/          React/Vite UI (dashboard, recordings, daily reports)
├── packages/
│   ├── db/           Mongoose models and indexes
│   └── shared/       Shared Zod schemas, types, constants and validation helpers
├── docker/
│   └── Dockerfile    Multi-target image: api | worker | web
├── docker-compose.yml
├── package.json      npm workspaces + root scripts
└── tsconfig.base.json
```

## Prerequisites

- Node.js 20+ (Node 22 LTS recommended; images use Node 22)
- npm 10+
- Docker Engine + Docker Compose v2

This machine also runs unrelated ClassEase and SAHER containers. CallMind uses
its own Compose project, network and volumes, and non-conflicting ports:

| Service | Host port | Container port |
| --- | --- | --- |
| MongoDB | `27018` | `27017` |
| Redis | `6380` | `6379` |
| API | `8080` | `8080` |
| Frontend | `5174` | `5173` |

MongoDB and Redis are bound to `127.0.0.1` only.

## Quick start (Docker, recommended)

```bash
cd /home/sachindjaiswal/newStudent/callMind
cp .env.example .env          # optional for Docker; Compose sets service URLs itself
npm install                   # creates package-lock.json used by Docker builds
npm run up                    # docker compose up -d --build
npm run ps                    # show service status
```

Open:

- Frontend: <http://localhost:5174>
- API health: <http://localhost:8080/api/health>

Verify the worker processes a smoke-test job:

```bash
npm run test:job
npm run logs
```

Stop everything (keeps data volumes):

```bash
npm run down
```

Do not use `docker compose down -v` unless deleting CallMind data is intended.

## Local development (without Docker for apps)

```bash
cp .env.example .env
npm install
npm run infra:up      # mongo:27018 + redis:6380
npm run dev           # builds shared, then runs api + worker + web concurrently
```

Or run each app in its own terminal:

```bash
npm run dev:api       # http://localhost:8080
npm run dev:worker
npm run dev:web       # http://localhost:5173 (proxies /api to :8080)
```

## Root scripts

| Command | Purpose |
| --- | --- |
| `npm run up` | Build and start the full Docker stack |
| `npm run down` | Stop the stack (keeps volumes) |
| `npm run restart` | Restart all services |
| `npm run ps` | Show service status |
| `npm run logs` | Follow logs |
| `npm run test:job` | Enqueue a smoke-test job for the worker |
| `npm run dev` | Run shared build + api/worker/web locally |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | TypeScript checks across all workspaces |
| `npm test` | Unit and integration tests (shared, db, api, worker, web) |

## Environment variables

See `.env.example`. Never commit `.env` or real secrets. Do not print environment
variables, API keys, or request headers while debugging.

| Variable | Used by | Description |
| --- | --- | --- |
| `NODE_ENV` | api, worker | `development` / `test` / `production` |
| `PORT` | api | API port (default `8080`) |
| `MONGODB_URI` | api, worker | MongoDB connection string |
| `REDIS_URL` | api, worker | Redis connection string |
| `CORS_ORIGIN` | api | Comma-separated allowed origins |
| `LOG_LEVEL` | api, worker | pino level |
| `STORAGE_DIR` | api, worker | Local audio storage root (Docker: `/app/storage`) |
| `MAX_UPLOAD_BYTES` | api | Per-file limit, default `26214400` (25 MiB) |
| `MAX_FILES_PER_UPLOAD` | api | Files per request, default `20` |
| `WORKSPACE_ID` | api | Workspace scope for recordings and reports, default `default` |
| `FFPROBE_PATH` | worker | `ffprobe` binary path, default `ffprobe` |
| `FFMPEG_PATH` | worker | `ffmpeg` binary path for Gemini transcription transcoding |
| `VITE_API_PROXY_TARGET` | web dev server | Server-side proxy target for `/api` |
| `GEMINI_API_KEY` | worker | Gemini API key for analysis and auto/Hindi STT |
| `GEMINI_MODEL` | worker | Gemini analysis model, default `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | worker | Gemini analysis fallback, default `gemini-3.1-flash-lite` |
| `GEMINI_STT_MODEL` | worker | Gemini transcription model, default `gemini-3.5-transcribe` |
| `GEMINI_STT_MAX_BYTES` | worker | Max bytes for Gemini transcription uploads |
| `GROQ_API_KEY` | worker | Groq API key for English Whisper transcription |
| `GROQ_STT_MODEL` | worker | Groq STT model, default `whisper-large-v3-turbo` |
| `GROQ_STT_MAX_BYTES` | worker | Groq transcription byte limit |
| `STT_STRATEGY` | worker | `language-aware` (default) or `groq-only` |

Only direct provider APIs are used. Keak OmniRoute is not part of this stack.

## Health endpoint

`GET /api/health` returns `200` when the API, MongoDB and Redis are reachable, and
`503` with `status: "degraded"` otherwise.

## Recording pipeline

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/recordings/config` | Upload limits, extensions and language hints |
| `POST` | `/api/recordings/upload` | Upload files via the `files` form field and optional `languageHint` |
| `GET` | `/api/recordings?status=&page=&limit=` | List recordings (newest first) |
| `GET` | `/api/recordings/:id` | Get one recording with transcript and analysis |
| `POST` | `/api/recordings/:id/retry` | Retry a failed preparation, transcription or analysis job |

Uploaded audio is never modified. Each file gets its own result (`created`,
`duplicate` or `rejected`), so one bad file never blocks a batch. Duplicate
detection uses a SHA-256 checksum scoped to the workspace.

### Transcription strategy

`languageHint` is accepted per upload:

| Hint | Provider | Model | Notes |
| --- | --- | --- | --- |
| `auto` | Gemini | `gemini-3.5-transcribe` | Detects language, enables diarization and word timestamps |
| `en` | Groq | `whisper-large-v3-turbo` | Preserves English business detail |
| `hi` | Gemini | `gemini-3.5-transcribe` | Hindi and other languages |

Gemini transcription transcodes unsupported containers with FFmpeg into temporary
files; originals remain untouched. Analysis uses Gemini structured output and
validates every insight quote/timestamp against the stored transcript before
persisting it.

## Daily reports

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/daily-reports` | Queue a report for explicit recording IDs, date and timezone |
| `GET` | `/api/daily-reports?reportDate=&status=&from=&to=&page=&limit=` | List reports |
| `GET` | `/api/daily-reports/:id` | Get one report |
| `GET` | `/api/daily-reports/:id/conflicts` | List conflicts |
| `PATCH` | `/api/daily-reports/:id/conflicts/:conflictId` | Resolve or dismiss a conflict |
| `POST` | `/api/daily-reports/:id/regenerate` | Queue a new report version from the same selection |

Example request:

```json
{
  "reportDate": "2026-11-21",
  "timezone": "UTC",
  "recordingIds": [
    "6b01be77d2324d50d6829b9e",
    "6b01be7bd2324d50d6829ba3"
  ]
}
```

Rules:

- Only explicitly selected recordings are included.
- Only `analysis_completed` recordings with completed analyses and valid linked
  transcripts are eligible.
- The reporting date is interpreted in the supplied IANA timezone; UTC is never
  assumed. Recordings outside that local date are rejected.
- Identical generation requests are rejected as duplicates. Regeneration creates
  a new version linked by `previousReportId`.
- Source recordings, transcripts and per-recording analyses are never modified.
- Every consolidated insight, relationship and conflict keeps source insight,
  analysis, recording, segment and quote references.
- Evidence is revalidated against transcript segments; fabricated quotes or
  timestamps are rejected.
- Groups are generic (`INSIGHT_CATEGORIES`), not sales/revenue-specific.
- Relationships are proposed/inferred only. They are never treated as confirmed
  facts; uncertain items remain separate.
- Conflicts start as `unresolved` and can be reviewed as `resolved` or
  `dismissed` without deleting the original values.

Consolidation is deterministic (`system` / `deterministic-v1`) to avoid inventing
facts or consuming analysis quota. It merges exact normalized subjects and
detects only explicit status, date and quantity disagreements across different
recordings. Similar names are not fuzzy-matched.

Report statuses: `queued`, `generating`, `completed`, `failed`. Jobs use a
dedicated BullMQ queue with bounded exponential retries, job IDs based on report
IDs, and atomic status claims to avoid concurrent double generation.

## Dashboard

The `/` dashboard is a read-only view of the selected daily report. It:

- Defaults to the browser's current local date and resolved IANA timezone.
- Fetches reports for the selected date and selects the newest completed report
  by default.
- Falls back to the newest available report timezone when the browser timezone
  has no report for that date, and exposes a timezone selector when multiple
  timezones are available.
- Preserves a manually selected historical report version during refreshes.
- Polls queued/generating reports every two seconds and stops on terminal status,
  date/timezone changes, or unmount.
- Shows the AI-generated report summary, report metadata, source recording count,
  insight count, relationship count and conflict count.
- Renders one card per source recording instead of separate top-level cards per
  insight category. Each card groups the recording's insights into only the
  sections that contain data (discussion points, people/organizations, tasks,
  commitments, decisions, dates/quantities/prices, risks/concerns/questions).
- Enriches each card with the existing recording/analysis API so detailed
  bullet-point call summaries, topics, metadata, rich insight fields and
  explicit/inferred markers can be shown without inventing facts.
- Shows relationships and conflicts only when the report contains them.
- Keeps report generation, regeneration and conflict review in `/daily-reports`.
- Opens evidence in the shared evidence drawer and can navigate to the linked
  source recording and transcript segment.

The dashboard does not invent category-specific fields. Daily reports only
expose lightweight insight summaries, so richer per-recording details are read
from the existing analysis data via `fetchRecording`; if that data is
unavailable, the card falls back to the report's consolidated insights.

## Testing

```bash
npm run typecheck
npm test
npm run build
docker compose config --quiet
```

Unit and integration tests cover date/timezone boundaries, source validation,
generic grouping, conservative relationships, conflict detection, evidence
tampering, API validation, duplicate prevention, regeneration, queue processing,
idempotency, conflict review, dashboard report selection, per-recording dashboard
cards, dashboard states and evidence navigation. Mocked provider responses are
used where a real API call is unnecessary.

Some existing API/worker fixtures use a hardcoded `2026-11-21` reporting date.
Those suites are date-sensitive when run on a different day and may fail with
`RECORDING_OUTSIDE_REPORT_DATE`; this is independent of the dashboard.

## Troubleshooting

- **Port already in use** — confirm with `ss -ltn | grep -E ':(27018|6380|5174|8080)'`.
  Only CallMind services should use these ports.
- **Docker permission denied** — ensure your user is in the `docker` group or run with
  appropriate permissions.
- **API restarts / unhealthy** — `npm run logs` and check service URLs indirectly via
  health output; never print secrets.
- **Worker not processing** — `npm run test:job` then `docker compose logs worker`.
- **Frontend shows "API offline"** — the Vite proxy target must reach the API
  (`http://api:8080` in Compose, `http://localhost:8080` locally).
- **Report failed with source validation error** — check that selected recordings
  are completed, belong to the workspace, and fall inside the report date in the
  selected timezone.

## Scope

Implemented: multi-file upload, preparation, language-aware transcription,
grounded Gemini analysis, recording UI, dedicated Daily Report model/API/worker/UI,
cross-recording intelligence, evidence validation, conflict review, regeneration,
read-only dynamic dashboard, evidence-to-recording navigation, and tests.

Not implemented by design: authentication, cloud object storage,
provider-agnostic routing layers, and Keak OmniRoute integration.
