# Formatting Report — CallMind Intelligence

**Date:** 27 November 2026
**Task:** Reformat the existing CallMind Mini Project–II paper to match the visual identity of `research/sample research paper.pdf`, without changing research content.
**Scope:** Formatting, typography, layout, build, and documentation only.

## 1. Outcome

The manuscript now uses a compact, single-column journal style matching the supplied sample's visual identity: A4 portrait, navy text, orange running header, light-blue email/links, grey-grid tables, numbered section headings, italic indented subsections, masthead on page 1, and a boxed page-number footer.

- Final PDF: `research/CallMind_Research_Paper.pdf`
- Editable source: `research/CallMind_Research_Paper.tex`
- Reusable style: `research/callmind-journal.sty`
- Original IEEEtran source preserved: `research/CallMind_Research_Paper.ieee-backup.tex`
- Font assets: `research/fonts/`

No research section, claim, figure, table, equation, citation, or reference was removed or rewritten.

## 2. Files created or modified

| File | Change |
|---|---|
| `research/CallMind_Research_Paper.tex` | Converted from IEEEtran two-column to `article` + `callmind-journal.sty`; replaced the title block with the sample-style masthead; converted `table*`/`figure*` floats; restyled all six tables; kept all content. |
| `research/callmind-journal.sty` | New reusable journal style: geometry, fonts, colors, masthead macros, section/subsection styles, caption styles, table helpers, bibliography hanging indent, header/footer. |
| `research/CallMind_Research_Paper.ieee-backup.tex` | Copy of the original IEEEtran source before conversion. |
| `research/fonts/` | Local DejaVu Sans and Carlito TTFs. |
| `research/README.md` | Updated build instructions, file list, font substitutions, and status. |
| `research/Formatting_Report.md` | This report. |
| `research/tools/latex_to_odt.py` | Reproducible LaTeX-to-ODT converter for editable copies. |
| `research/docs/CallMind_Research_Paper.odt` | Editable OpenDocument version. |
| `research/docs/CallMind_Research_Paper.docx` | Editable Word version exported from the ODT. |
| `research/docs/CallMind_Research_Paper.pdf` | Preview of the ODT export (14 pages; reflow differs from LaTeX). |
| `research/docs/README.md` | Editing and regeneration instructions for the Office versions. |
| `.superpowers/sdd/callmind-journal-format/progress.md` | Execution ledger and rulings. |

No application source, database, schema, Docker configuration, `.env` file, Git commit, or live AI provider was touched.

## 3. Style implementation

### 3.1 Page and typography

- A4 portrait, `geometry`: left 30 mm, right 29 mm, top 26 mm, bottom 26 mm.
- Single column; white background; no outer border.
- Body: 9.5 pt / 11.5 pt, justified, no first-line indent, 5.5 pt paragraph spacing.
- Title label “Research paper”: 23 pt bold navy, left aligned.
- Paper title: 13.5 pt bold navy, centered.
- Author name and affiliation: 9.5 pt bold navy, centered.
- Email: 9.5 pt light blue, centered.
- Section headings: 9.5 pt bold navy, numbered, left aligned.
- Subsections: 9.5 pt italic navy, numbered, slightly indented.
- Widow/orphan control enabled; `\needspace` prevents stranded headings.

### 3.2 Colors

| Element | Hex | Verified in PDF |
|---|---|---|
| Body, headings, title, table text | `#003399` | Yes — sampled RGB `(0, 51, 153)` |
| Running header | `#ED7D31` | Yes — sampled RGB `(237, 125, 49)` |
| Email and hyperlinks | `#0084EF` | Yes — sampled RGB `(0, 132, 239)` |
| Table header background | `#D0D0D0` | Yes — sampled RGB `(208, 208, 208)` |
| Table borders | `#B7B7B7` | Yes — sampled RGB `(183, 183, 183)` |
| Footer border/text | black/dark grey | Yes — sampled RGB `(0, 0, 0)` and grey antialiasing |

### 3.3 Fonts and substitutions

The reference PDF embeds Verdana and Calibri; neither is installed in this environment.

| Requirement | Substitution | Reason |
|---|---|---|
| Verdana body/title/headings/tables | DejaVu Sans, local TTFs, `Scale=1.03` | Closest installed Verdana-like sans face; scale chosen to match the sample's body line width. |
| Calibri running header and footer page number | Carlito, local TTFs | Metric-compatible open substitute for Calibri. |
| Math | Computer Modern math fonts | Preserves the original equation rendering; no math content changed. |

All primary fonts are embedded in the PDF (`pdffonts` confirms DejaVu Sans/Bold/Oblique, Carlito Regular/Italic, and DejaVu Sans Mono).

### 3.4 First page

The first page follows the required order:

1. Centered orange running header.
2. Large left-aligned “Research paper” label.
3. Centered paper title.
4. Centered author name and affiliation.
5. Centered guide name and affiliation.
6. Thin navy separator.
7. Centered light-blue placeholder emails.
8. Bold “Abstract” heading and justified abstract.
9. Bold `Keywords:` label followed by the keyword list.
10. Section 1 begins on page 2; page 1 is intentionally dense with the masthead, abstract, and keywords.

Author, guide, email, and department fields remain placeholders; no identity was invented.

### 3.5 Tables and figures

- All six tables use light-grey gridlines, grey header rows, navy 7.5 pt text, bold navy header labels, compact padding, and captions above.
- Table widths fit the text block; `pdftotext -bbox` confirms no text outside the left margin after the bibliography indent fix.
- No table is split across pages in the rendered PDF.
- Both figures are preserved, centered, scaled to the text width, with captions below. No decorative frame was added.
- Equations remain centered, numbered, and within margins.

### 3.6 References and footer

- References are single-column with a modest hanging indent inside the left margin.
- All nine bibliography entries are present and cited; BibTeX reported no undefined citations.
- Hyperlinks are active; `pdfinfo -url` reports 12 link annotations, including DOI, ACL Anthology, arXiv, and PMLR URLs.
- Every page has the centered orange header and the centered boxed page number with the small vertical line below it.

## 4. Build

Built from `research/` with TinyTeX:

```bash
export PATH="$HOME/.TinyTeX/bin/x86_64-linux:$PATH"
xelatex -interaction=nonstopmode CallMind_Research_Paper.tex
bibtex CallMind_Research_Paper
xelatex -interaction=nonstopmode CallMind_Research_Paper.tex
xelatex -interaction=nonstopmode CallMind_Research_Paper.tex
```

Additional TinyTeX packages installed for this task: `colortbl`, `needspace`.

Final build result:

- `xelatex` final exit: 0
- `bibtex` exit: 0
- LaTeX errors: 0
- Overfull boxes: 0
- Underfull boxes: 1 non-fatal hbox in a justified list item (badness 1552)
- Font-size substitution warnings: 10 non-fatal math-font warnings (Computer Modern sizes)
- PDF pages: 12
- Page size: 595.28 × 841.89 pt (A4)
- Producer: xdvipdfmx

## 5. Visual QA

Every rendered page was inspected at 100 dpi. The following were checked:

| Check | Result |
|---|---|
| A4 portrait | Pass |
| Single-column, white background, no border | Pass |
| Header/footer on all 12 pages | Pass |
| Page numbers sequential 1–12 | Pass |
| Masthead order on page 1 | Pass |
| Section/subsection hierarchy and numbering | Pass |
| Justification and navy body color | Pass |
| Orange header and light-blue email | Pass |
| Table grey headers/borders and navy text | Pass |
| Figures present, centered, captions below | Pass |
| Equations preserved and within margins | Pass |
| References single-column with hanging indent | Pass |
| No text outside page margins | Pass — `xMin=84.56 pt`, `xMax=515.30 pt` |
| No stranded headings | Pass — checked pages 3, 4, and 8 after adding `\needspace` |
| No table splitting or clipping | Pass |
| Hyperlinks present | Pass |
| Research content preserved | Pass — 9 sections, 28 subsections, 6 tables, 2 figures, 9 references match the backup |

## 5.1 Editable ODT / DOCX derivative

An editable derivative was requested after the PDF review. `research/tools/latex_to_odt.py`
parses the LaTeX source and the generated `.bbl`, and produces `research/docs/CallMind_Research_Paper.odt`.
LibreOffice then exports `CallMind_Research_Paper.docx` and a preview PDF.

QA on the Office versions:

- ODT contains all 9 sections, 28 subsections, 6 numbered tables, 2 numbered figures,
  4 equations, and 9 references.
- Captions read `Table 1.`–`Table 6.` and `Figure 1.`–`Figure 2.`; cross-references such as
  `Table~\ref{tab:...}` resolve to the correct numbers.
- LibreOffice export succeeds for both DOCX and PDF.
- Preview PDF is 13 A4 pages; the DOCX export also renders to 13 pages.
- Embedded fonts are DejaVu Sans, DejaVu Sans Bold, Carlito Regular, and Carlito Italic;
  no LiberationSerif fallback remains.
- The orange running header and boxed automatic page number are present in the master page
  and survive DOCX export.
- A repeatable regression check is available at `research/tools/test_odt_styling.py`;
  it passes.

## 6. Known limitations and remaining work

1. Author, guide, email, department, and `[Guide Email]` placeholders still need to be completed before submission.
2. The affiliation wording came from the prior draft and should be confirmed against the department's official wording.
3. The supplied sample is 11 pages; this paper is 12 pages because its content is longer. The target venue's page limit should be checked before final submission.
4. Math-font size substitution warnings remain in the log, but the rendered equations are correct and embedded.
5. One underfull hbox remains in a justified list item; it is not visible as a layout defect in the rendered PDF.
6. No semantic research review was repeated; this report covers formatting only.

## 7. Integrity statement

- No application source files were changed.
- No database or schema writes were performed.
- No live Gemini/Groq/provider calls were made.
- No Docker start/restart/rebuild/compose action was performed.
- No `.env`, credential, or secret file was read or modified.
- No Git commit, history change, or push was made.
- No research artifact was deleted; the original IEEE source is preserved as `research/CallMind_Research_Paper.ieee-backup.tex`.
- No author, institution, citation, result, or metric was invented.
