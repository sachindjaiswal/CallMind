# Editable Word/ODF versions of the CallMind paper

This folder contains editable derivatives of `research/CallMind_Research_Paper.tex`.

| File | Use |
|---|---|
| `CallMind_Research_Paper.odt` | OpenDocument Text for LibreOffice / OpenOffice. This is the primary editable version. |
| `CallMind_Research_Paper.docx` | Microsoft Word version exported from the ODT with LibreOffice. |
| `CallMind_Research_Paper.pdf` | Visual preview of the ODT export; page breaks differ from the LaTeX PDF. |
| `images/` | PNG renderings of the two LaTeX figures used inside the ODT/DOCX. |
| `../tools/latex_to_odt.py` | Reproducible converter from the LaTeX source to ODT. |

## Editing guidance

- Edit the `.odt` in LibreOffice if you want an open format, or the `.docx` in Word.
- Do not edit `CallMind_Research_Paper.pdf`; it is only a preview.
- For structural or evidence-sensitive changes (results, claims, citations), prefer editing the LaTeX source and rebuilding both PDF and Office versions. This keeps all deliverables consistent.
- Simple copy or formatting edits can be made directly in the ODT/DOCX. If you later change the LaTeX source, regenerate the ODT/DOCX with the script so the two do not diverge.

## Regenerate the editable versions

From `research/`:

```bash
python3 tools/latex_to_odt.py
cd docs
libreoffice --headless --convert-to docx:"MS Word 2007 XML" --outdir . CallMind_Research_Paper.odt
libreoffice --headless --convert-to pdf --outdir . CallMind_Research_Paper.odt
```

The converter needs `odfpy` and `Pillow`, plus `pdftoppm` for figure rendering.

## Known differences from the LaTeX PDF

- The ODT/DOCX reflows to 13 A4 pages; the LaTeX PDF is 12 pages.
- The orange running header and boxed automatic page number are reproduced in the ODT and DOCX master pages.
- The DejaVu Sans body and Carlito header/footer fonts are embedded in the rendered preview. Carlito is installed locally for LibreOffice; if you move the ODT to a machine without Carlito, Word/LibreOffice will substitute a Calibri-like font.
- Word/LibreOffice may change line breaks and table row heights slightly.

## Current placeholders

The author line currently reads `[Sachin.D.Jaiswal]` in the source and derived documents. The following placeholders remain and should be completed before submission:

`[Student Email]`, `[Guide Name]`, `[Guide Designation]`, `[Department]`, `[Guide Email]`.
