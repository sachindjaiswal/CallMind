# CallMind Journal-Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-typeset the existing CallMind research paper into the single-column, navy, journal-style visual identity of `research/sample research paper.pdf` without changing research content.

**Architecture:** A reusable `research/callmind-journal.sty` supplies page geometry, fonts, colors, heading styles, captions, table helpers and the running header/footer. The paper switches from `IEEEtran` to `article`, keeps all body text and citations, and compiles with XeLaTeX + BibTeX.

**Tech Stack:** XeLaTeX, `fontspec`, DejaVu Sans, Carlito, `geometry`, `titlesec`, `fancyhdr`, `caption`, `booktabs`, `colortbl`, `hyperref`, BibTeX with `IEEEtran.bst`.

**Spec:** `research/Formatting_Design.md`

## Global Constraints

- Preserve every paragraph, equation, table row, figure, citation and reference.
- Do not rewrite, shorten, expand or invent research content.
- Keep the existing numeric `[n]` citation style and bibliography keys.
- Keep author/guide placeholders exactly as they exist.
- No app source, database, Docker, provider, `.env` or Git history changes.
- No Git commits; the repository is untracked under `research/`.
- Final PDF must be A4 portrait, single column, with consistent margins and no clipped content.

## Review Focus

- **Missing content after float conversion:** every `table*`/`figure*` must become a single-column float without losing rows, columns or captions.
- **Wide tables overflowing the text block:** check `Overfull \hbox` warnings and visible right-edge clipping.
- **Font fallback failures:** XeLaTeX must find DejaVu Sans and the bundled Carlito files on a clean run.
- **Bibliography formatting:** all nine `\cite` keys must resolve and all entries must remain visible.
- **Page furniture:** running header and boxed footer must appear on every page, with sequential numbering and no overlap.

---

### Task 1: Create the style assets and preserve the original

**Files:**
- Create: `research/fonts/Carlito-Regular.ttf`
- Create: `research/fonts/Carlito-Bold.ttf`
- Create: `research/fonts/Carlito-Italic.ttf`
- Create: `research/fonts/Carlito-BoldItalic.ttf`
- Create: `research/callmind-journal.sty`
- Copy: `research/CallMind_Research_Paper.tex` to `research/CallMind_Research_Paper.ieee-backup.tex`

**Interfaces:**
- Produces style package macros/colors used by later tasks: `navy`, `linkblue`, `headerorange`, `tableborder`, `headergray`, `\ResearchPaperLabel`, `\journaltablefont`, `\journalheadrow`, `\journalcaption`.
- Produces font files referenced by `\newfontfamily{\journalheaderfont}{Carlito}`.

- [ ] **Step 1: Back up the original source**

Run: `cp research/CallMind_Research_Paper.tex research/CallMind_Research_Paper.ieee-backup.tex`
Expected: backup file exists and is byte-identical to the original.

- [ ] **Step 2: Download the four Carlito faces**

Download from the Google Fonts CSS URLs already resolved for Carlito v4:
`3Jn9SDPw3m-pk039PDA.ttf` (regular), `3Jn4SDPw3m-pk039BIykaX0.ttf` (bold),
`3Jn_SDPw3m-pk039DDKBSQ.ttf` (italic), `3Jn6SDPw3m-pk039DDK59XglVg.ttf` (bold italic).
Save under `research/fonts/` with the names above.
Expected: `file research/fonts/Carlito-*.ttf` reports TrueType font data.

- [ ] **Step 3: Create `research/callmind-journal.sty`**

Define:
- `\ProvidesPackage{callmind-journal}`
- colors: `navy` `#003399`, `linkblue` `#0084EF`, `headerorange` `#ED7D31`, `tableborder` `#B7B7B7`, `headergray` `#D0D0D0`
- `\setmainfont{DejaVu Sans}` and `\newfontfamily{\journalheaderfont}{Carlito}`
- `geometry` A4 with left 30 mm, right 29 mm, top 26 mm, bottom 26 mm
- `titlesec` section: bold navy 9.5/11.5, numbered `1.`; subsection: italic navy 9.5/11.5, indented, numbered `2.1.`
- `caption` setup: navy 9.5/11.5, label separator period, ragged-right, no single-line centering
- `fancyhdr`: centered orange italic Carlito header and centered boxed page-number footer with short vertical line
- `\ResearchPaperLabel`: bold navy 23 pt, left aligned
- `\journaltablefont`: 7.5/9 pt navy
- `\journalheadrow`: bold header row on `headergray`
- `\journalcaption`: caption helper if needed

- [ ] **Step 4: Compile a minimal smoke test**

Create a temporary `research/_fonttest.tex` using the style package, one heading, one sentence and one table row. Run:
`export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$PATH"; xelatex -interaction=nonstopmode _fonttest.tex`
Expected: exit 0, `Output written ... _fonttest.pdf`, no font-not-found errors. Remove `_fonttest.*` afterwards.

---

### Task 2: Convert the document shell and first-page masthead

**Files:**
- Modify: `research/CallMind_Research_Paper.tex:1-71`

**Interfaces:**
- Consumes: `callmind-journal.sty` from Task 1.
- Produces: a single-column `article` document with the reference masthead and abstract/keywords.

- [ ] **Step 1: Replace the preamble**

Use `\documentclass[11pt,a4paper]{article}` and load `callmind-journal`, `amsmath`, `amssymb`, `graphicx`, `booktabs`, `multirow`, `array`, `url`, `cite`, `xcolor` with table support, `hyperref` and `microtype`. Remove `IEEEtran`, `fontenc`, `inputenc` and IEEE-specific class assumptions.

- [ ] **Step 2: Replace the title/author block**

Remove `\title`, `\author`, `\IEEEauthorblockN`, `\IEEEauthorblockA` and `\maketitle`. Insert:
- `\ResearchPaperLabel`
- centered 13.5 pt bold navy title
- centered bold navy author/affiliation lines with the existing placeholders
- `\textcolor{navy}{\rule{\linewidth}{0.4pt}}`
- centered `\textcolor{linkblue}{[Student Email]}` and `\textcolor{linkblue}{[Guide Email]}`

Keep both authors and the exact institution wording already present.

- [ ] **Step 3: Replace the abstract and keywords environments**

Use `\section*{Abstract}` plus a justified paragraph; use `\textbf{Keywords:}` followed by the existing keyword list in regular text. Do not use `IEEEkeywords` or a colored box.

- [ ] **Step 4: Verify front matter compiles**

Run the full XeLaTeX/BibTeX sequence once. Expected: first page renders with the masthead, abstract, keywords and Section 1; no undefined control sequences from removed IEEE macros.

---

### Task 3: Convert floats, tables, captions and references

**Files:**
- Modify: `research/CallMind_Research_Paper.tex` table/figure blocks at lines ~268, ~304, ~358, ~399, ~503, ~540, ~591, ~625 and the bibliography at ~720.

**Interfaces:**
- Consumes: `\journaltablefont`, `\journalheadrow`, table colors and caption setup.
- Produces: single-column floats that fit the 428 pt text block and a formatted reference list.

- [ ] **Step 1: Convert `table*` and `figure*` to single-column floats**

Replace each `table*` with `table` and each `figure*` with `figure`. Keep every `\caption`, `\label`, row, column and note. Reduce figure widths to `\linewidth` (or slightly less) so aspect ratios are preserved.

- [ ] **Step 2: Fit wide tables**

For `tab:related` and `tab:impl`, reduce column widths and `\tabcolsep` until the table fits `\linewidth`; use `\journaltablefont` and `\journalheadrow`. Keep all six/three columns and every row. For the smaller tables, keep their existing column structure but apply the journal table font and header row.

- [ ] **Step 3: Apply light-grey grid styling**

Add vertical rules and thin grey horizontal rules to each table, or use the helper macros defined in Task 1. Header rows use `headergray`; all rules use `tableborder`. Do not use heavy black outlines.

- [ ] **Step 4: Format the bibliography**

Keep `\bibliographystyle{IEEEtran}` and `\bibliography{references}`. Wrap the bibliography in 9.5/11.5 pt navy text, set a modest hanging indent, and keep the `References` heading styled by the section formatter. Verify all nine entries remain.

- [ ] **Step 5: Compile and inspect float pages**

Run XeLaTeX, BibTeX, XeLaTeX, XeLaTeX. Expected: no missing figures, no undefined citations, no overfull boxes wider than 1 pt, and all tables visible within the text block.

---

### Task 4: Full PDF QA and documentation

**Files:**
- Modify: `research/README.md`
- Create: `research/Formatting_Report.md`
- Rebuild: `research/CallMind_Research_Paper.pdf`

**Interfaces:**
- Consumes: the formatted source from Tasks 2–3.
- Produces: final PDF and a QA report documenting checks, font substitutions and any residual issues.

- [ ] **Step 1: Clean and rebuild**

Remove stale `.aux`, `.bbl`, `.blg`, `.log`, `.out` for the paper, then run the full XeLaTeX/BibTeX sequence. Expected: exit 0 and a fresh PDF.

- [ ] **Step 2: Verify page geometry and page count**

Run `pdfinfo research/CallMind_Research_Paper.pdf`. Expected: A4 portrait, page count recorded, no errors.

- [ ] **Step 3: Check fonts and text color**

Run `pdffonts research/CallMind_Research_Paper.pdf`. Expected: DejaVu Sans and Carlito embedded; no missing-font warnings. Spot-check XML/color output for `#003399`, `#ED7D31` and `#0084EF`.

- [ ] **Step 4: Inspect every page**

Render all pages to PNG and check: running header, boxed footer, heading hierarchy, justified body, table headers/borders, figure placement, references and absence of clipped or blank pages. Fix any layout defect and repeat.

- [ ] **Step 5: Verify content preservation**

Compare section headings, table row counts, figure count, equation count and citation keys against `CallMind_Research_Paper.ieee-backup.tex`. Expected: no missing content.

- [ ] **Step 6: Write `research/Formatting_Report.md`**

Record the reference analysis, files changed, font substitutions (Verdana → DejaVu Sans; Calibri → Carlito), compilation commands, page count, QA checks and any limitations. Update `research/README.md` with the new build command and style file.
