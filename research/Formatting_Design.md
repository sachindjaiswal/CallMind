# CallMind Journal-Format Design

**Date:** 27 November 2026  
**Task:** Reformat the existing CallMind research paper to match the visual identity of
`research/sample research paper.pdf` without rewriting its research content.

## Intent

The existing paper is a valid IEEEtran two-column manuscript. The reference is a
single-column, journal-style A4 document with navy body text, a centered orange running
header, a distinctive first-page masthead, grey-grid tables and a boxed page-number footer.
The goal is visual and typographic alignment, not a new paper.

## Goals

- Single-column A4 with approximately 30 mm left, 29 mm right, 26 mm top and 26 mm bottom
  margins.
- Navy (`#003399`) body text, headings, title, author details, tables and references.
- DejaVu Sans as the closest installed Verdana-like face; Carlito for the Calibri-style
  running header.
- Reference-style first page: running header, left-aligned “Research paper” label, centered
  title, author/affiliation block, blue separator, email line, abstract and keywords.
- Numbered bold section headings and italic numbered subsection headings.
- Justified 9.5 pt body text with compact paragraph spacing.
- Captions above tables, below figures; light-grey table headers and thin grey gridlines.
- Single-column, blue, hanging-indent references with italic publication titles.
- Centered boxed page number with a short vertical line below it on every page.
- Preserve every equation, figure, table, citation, reference and paragraph.

## Non-goals

- No research rewriting, shortening, expansion, fact changes or new claims.
- No new authors, institutions, references or experimental results.
- No two-column IEEE layout in the final PDF.
- No decorative cover page, gradients, cards or modern marketing styling.

## Constraints

- Source is `research/CallMind_Research_Paper.tex` (LaTeX).
- Existing numeric citations must remain consistent with the bibliography.
- Author/guide fields remain the existing placeholders.
- No application code, database, Docker, provider or Git history changes.
- The original IEEE-format source must be backed up before formatting changes.

## Approaches considered

1. **XeLaTeX + custom single-column style layer (chosen).** `fontspec` can use DejaVu Sans
   and Carlito directly; `geometry`, `titlesec`, `fancyhdr`, `caption`, `booktabs` and
   `colortbl` cover the reference layout. This preserves equations and BibTeX while allowing
   a faithful visual match.
2. **pdfLaTeX with Helvetica/Times substitution.** Simpler, but cannot use the available
   TrueType faces well and would look less like the reference.
3. **Convert to DOCX.** Would require reconstructing equations, figures and citations and
   would risk content loss. Rejected.

## Chosen design

- Add `research/callmind-journal.sty` for centralized colors, fonts, page geometry, heading
  styles, caption styles, table helpers and footer design.
- Convert the preamble from `IEEEtran` conference two-column to `article` with the style
  package.
- Replace the IEEE author block with the reference masthead structure, retaining all
  existing placeholder text.
- Keep all section/subsection commands; let LaTeX number them `1.`, `2.1.`, etc.
- Convert wide `table*` floats to single-column `table` floats and reduce table font size;
  preserve every row and column.
- Keep both figures, scaled to the text width, with captions below.
- Keep `\bibliographystyle{IEEEtran}` for numeric citations and URL support, but wrap the
  bibliography in the journal font/color and hanging indent.
- Add the running header and boxed page-number footer through `fancyhdr`.
- Compile with XeLaTeX, BibTeX, XeLaTeX, XeLaTeX.

## Font substitution

- **Verdana:** not installed. DejaVu Sans is the closest installed humanist sans and is
  wider than Noto Sans/Liberation Sans, matching Verdana's compact journal density better.
- **Calibri:** not installed. Carlito (metric-compatible with Calibri, SIL OFL) will be
  stored under `research/fonts/` and used only for the running header.
- This substitution will be documented in the final report.

## Quality checks

- A4 portrait, single column, consistent margins on every page.
- Running header and boxed footer on every page; sequential automatic numbering.
- No missing text, figures, tables, equations or references.
- No overfull boxes, clipped content, stranded headings or broken tables.
- Citation keys and bibliography entries match; hyperlinks remain functional.
- Visual inspection of first, middle, table-heavy and final pages.
