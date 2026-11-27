# CallMind Intelligence — Research Materials

This directory contains the formatted research-paper manuscript and its supporting evidence
for the Mini Project–II submission. The manuscript is a single-column journal-style paper
modelled on the visual identity of `sample research paper.pdf`; the original IEEEtran draft
is preserved as `CallMind_Research_Paper.ieee-backup.tex`.

## Contents

| File | Purpose |
|---|---|
| `CallMind_Research_Paper.tex` | Main editable manuscript in the CallMind journal style. |
| `CallMind_Research_Paper.pdf` | Compiled 12-page A4 manuscript with the reference journal's visual identity. |
| `docs/CallMind_Research_Paper.odt` | Editable LibreOffice/OpenDocument version of the paper. |
| `docs/CallMind_Research_Paper.docx` | Editable Microsoft Word version exported from the ODT. |
| `docs/README.md` | Instructions for editing and regenerating the ODT/DOCX. |
| `tools/latex_to_odt.py` | Converter from the LaTeX source to ODT. |
| `callmind-journal.sty` | Reusable style: A4 geometry, navy/orange palette, masthead, headings, tables, captions, header/footer. |
| `CallMind_Research_Paper.ieee-backup.tex` | Original IEEEtran source, kept as a backup. |
| `research/fonts/` | Local DejaVu Sans and Carlito font files used by XeLaTeX. |
| `references.bib` | Verified bibliography (9 entries: 8 required papers + Whisper). |
| `Literature_Review_Matrix.md` | Focused narrative review, comparative matrix, and scoped gap justification. |
| `Experiment_and_Evidence_Log.md` | Exact commands, dates, test results, and read-only persisted-data audit. |
| `Research_Claims_and_Limitations.md` | Claim-by-claim evidence ledger and disclosed limitations. |
| `Revision_Report.md` | Record of the academic corrections, verification results, and remaining placeholders. |
| `Formatting_Report.md` | Record of the journal-style reformat, font substitutions, build, and visual QA. |
| `figures/architecture.tex` / `.pdf` | Vector system-architecture diagram (Figure 1). |
| `figures/provenance.tex` / `.pdf` | Vector evidence-provenance chain (Figure 2). |

## How to compile

The manuscript uses `article` with the local `callmind-journal.sty`, `xelatex`/`fontspec`,
`multirow`, numeric `cite` references, and `IEEEtran.bst`. Compile from the `research`
directory so the local style and font paths resolve.

```bash
cd research
export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$PATH"
xelatex -interaction=nonstopmode CallMind_Research_Paper.tex
bibtex CallMind_Research_Paper
xelatex -interaction=nonstopmode CallMind_Research_Paper.tex
xelatex -interaction=nonstopmode CallMind_Research_Paper.tex
```

TinyTeX packages required beyond the base installation include `fontspec`, `geometry`,
`titlesec`, `fancyhdr`, `caption`, `booktabs`, `colortbl`, `needspace`, `microtype`,
`amsmath`, `amssymb`, `url`, `cite`, `hyperref`, `multirow`, and `standalone`.

### Figures

The figures are standalone TikZ documents. Rebuild them with:

```bash
cd research/figures
pdflatex architecture.tex
pdflatex provenance.tex
```

The main paper includes the resulting PDFs, so rebuild the figures before the paper if
their `.tex` sources change.

### Editable ODT / DOCX

```bash
python3 tools/latex_to_odt.py
cd docs
libreoffice --headless --convert-to docx:"MS Word 2007 XML" --outdir . CallMind_Research_Paper.odt
libreoffice --headless --convert-to pdf --outdir . CallMind_Research_Paper.odt
```

See `docs/README.md` for editing guidance and known differences from the LaTeX PDF.

## Font substitutions

The reference PDF embeds Verdana and Calibri, which are not installed in this environment.

- **Verdana → DejaVu Sans** (local TTFs in `research/fonts/`), scaled to 1.03 to match the
  reference body width.
- **Calibri → Carlito** (local TTFs in `research/fonts/`), used for the running header and
  the page-number footer.

Both substitutes are metrically compatible open fonts and are embedded in the PDF.

## Author information still required

The following are **placeholders** and must be completed before submission. They were not
invented because they cannot be verified from the repository.

- `[Student Name]` — author name.
- `[Student Email]` — institutional or personal email.
- `[Guide Name]` — project guide / supervisor.
- `[Guide Designation]` — e.g., Assistant Professor.
- `[Department]` — e.g., Department of Computer Science.
- `[Guide Email]` — guide email.
- Affiliation wording: the paper currently uses
  “Government of Maharashtra’s Ismail Yusuf College of Arts, Science and Commerce,
  Jogeshwari (East), Mumbai 400 060, India”, affiliated to the University of Mumbai.
  Confirm the exact official wording with the department.
- Whether a second author (e.g., guide) should be listed as co-author or acknowledged.

## Evidence status

- **Functional verification:** performed offline on 25 November 2026.
  `npm run typecheck` and `npm run build` pass. Tests: 30 files, 175 tests, 170 passed,
  5 failed (date-sensitive daily-report fixtures).
- **Persisted-data audit:** read-only. 8 recordings, 6 completed analyses, 5 completed
  reports. Evidence audit: 6/6 per-recording insights and 9/9 consolidated evidence items
  re-validated against stored transcripts. These are provenance-consistency results, not
  semantic-accuracy or extraction-quality measurements.
- **Date scoping:** report eligibility uses recording creation time and the requested IANA
  timezone; the actual conversation date is not independently inferred or validated.
- **No live provider calls** were made, and **no production queue** was triggered, in
  accordance with the development boundary (Phase 3G-C not started).
- **No accuracy metric** (WER, CER, precision, recall, F1) is reported because no reference
  transcripts or human annotations exist.

## Honest status of this deliverable

This is a **complete research-paper draft**, not a fully verified or submission-ready
manuscript. Before submission:

1. Fill in the author/guide placeholders and confirm the affiliation wording.
2. Fix the five date-sensitive fixtures (pin `createdAt` in the fixtures) so the `api`
   and `worker` suites are green, then re-run and update the numbers if they change.
3. Ideally, annotate a small held-out set of recordings to compute at least evidence-level
   precision/recall and category-wise extraction counts. Until then, the paper reports
   only descriptive and provenance metrics.
4. If possible, run the same recordings through the two baselines described in the paper
   (transcript-only and independent per-recording summaries) so the qualitative capability
   comparison can be complemented by a small quantitative study.
5. Re-read the target venue’s page limit and formatting rules. The current 12-page PDF
   follows the supplied journal-style sample, not the earlier 6–8 page IEEE constraint.

## Integrity notes

- No `.env` values, API keys, tokens, credentials, MongoDB IDs, private filenames, phone
  numbers, customer names, or raw transcript text are included in this directory.
- The manuscript does not use “first-ever”, “world’s first”, “no existing solution”, or
  similar unverifiable novelty claims.
- All numerical results in the paper are traceable to `Experiment_and_Evidence_Log.md`.
- No application source, database, Docker state, Git history, or live AI provider was
  changed or invoked during the formatting work.
