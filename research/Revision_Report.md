# Revision Report — CallMind Mini Project–II Research Paper

**Date:** 25 November 2026  
**Scope:** Targeted academic-correction pass on the existing research paper and supporting
documentation. No development phase was restarted and no new experiments were run.

## Corrections applied

1. **Research objectives added.** The manuscript now states five explicit objectives before
   R1–R7. R1–R7 are retained and relabelled as system requirements; RQ1–RQ3 remain unchanged.
2. **Literature methodology added.** Section III now declares a focused narrative review,
   not a systematic review. Sources (ACL Anthology, arXiv, Crossref, conference proceedings
   and publisher records) and search themes are stated. The gap statement is scoped to the
   selected literature and does not claim universal novelty.
3. **Evidence validation qualified.** The 6/6 and 9/9 results are described as consistency
   with the implemented provenance rules, not semantic accuracy, extraction quality, or
   independent human validation. Quote containment and timing are explicitly distinguished
   from semantic entailment.
4. **Date semantics clarified.** The paper now states that report-date eligibility uses the
   recording creation timestamp and the requested IANA timezone, and that the actual
   conversation date is not independently inferred or validated. The discussion explains
   that this is a report-scoping date rather than the conversation date.
5. **Consolidation claims qualified.** Relationship and conflict handling is described as
   rule-based and limited to explicit rules. Selected conflict detection covers status,
   date and quantity disagreements; no claim is made about all contradiction types.
   The 0 relationships / 0 conflicts result is treated as an observation, with those code
   paths supported by implementation inspection and unit tests only.
6. **Evaluation corpus described.** A new subsection records the small functional smoke-test
   corpus: 8 recordings, 6 completed analyses, 7 transcripts, 5 completed reports, durations
   of about 1.7–44 s, provider and language-tag distribution, and the absence of ground-truth
   labels or reference transcripts.
7. **References corrected and validated.** Golia & Kalita now prints DOI
   `10.1145/3639233.3639253` as the access URL with `arXiv:2312.17581` retained as an
   additional note. Crossref page ranges were checked: P4 is pp. 1–5 and P5 is pp. 91–98;
   the previous P5 range `pp. 1–8` was corrected. All 9 in-text citation keys resolve to
   bibliography entries, all bibliography entries are cited, and no `\ref` label is missing.
8. **Abstract and conclusion aligned.** Both now state that the audit shows provenance
   consistency rather than extraction accuracy, and the abstract uses “relationship and
   conflict proposals” instead of implying observed outcomes.
9. **Supporting documents updated.** The literature matrix, experiment log, claim ledger and
   research README now carry the same methodology, qualification, classification and
   limitation wording.

## Files changed

- `research/CallMind_Research_Paper.tex`
- `research/CallMind_Research_Paper.pdf` (rebuilt)
- `research/references.bib`
- `research/Literature_Review_Matrix.md`
- `research/Experiment_and_Evidence_Log.md`
- `research/Research_Claims_and_Limitations.md`
- `research/README.md`
- `research/Revision_Report.md` (created)

No application source file, test, schema, database record, Docker configuration, `.env`
value or credential was modified.

## Verification performed

- LaTeX compile sequence, using TinyTeX:
  `export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$PATH"`, then
  `pdflatex`, `bibtex`, `pdflatex`, `pdflatex` with `-interaction=nonstopmode -halt-on-error`.
- Final PDF: **8 pages**, A4, correct title. No `Overfull` boxes were reported. Underfull
  boxes reported by TeX are normal two-column line-breaking warnings, not layout overflows.
- Citation/label audit: 9 citation keys used, 9 bibliography entries present, no missing or
  unused keys, no missing `\ref` labels.
- Required corrected wording was found in the extracted PDF text, including the narrative
  review methodology, five research objectives, exact date-scope statement, provenance-vs-
  semantic qualification, rule-based conflict qualification, P5 pages 91–98 and the P5 DOI URL.
- `npm run typecheck` was re-run after the documentation work and exited 0.
- `git status --short` showed only `?? research/`; no tracked file was modified and no commit
  was created.

## Placeholders still required before submission

- `[Student Name]`
- `[Student Email]`
- `[Guide Name]`
- `[Guide Designation]`
- `[Department]`
- `[Guide Email]`
- Confirmation of the exact official affiliation wording.
- Confirmation of whether the guide should be a co-author or acknowledged.

These were not invented. The paper retains them visibly so they cannot be mistaken for
verified metadata.

## Unmet items / honest caveats

- No reference transcripts or human annotations exist, so WER, CER, precision, recall and F1
  are still not reported.
- The 6/6 and 9/9 provenance results do not demonstrate semantic correctness.
- The 0 relationships / 0 conflicts result does not estimate relationship or conflict
  detection accuracy.
- Five date-sensitive daily-report fixture failures remain unchanged; fixing them was out of
  scope for this paper-correction pass.
- No live Gemini or Groq call was made, no queue job was triggered, no Docker action was
  taken, no database write was issued, and no Git commit, history rewrite or push was made.
