#!/usr/bin/env python3
"""Convert the CallMind LaTeX paper into an editable ODT document.

The converter is intentionally project-specific: it preserves the paper's
section structure, tables, equations, figures, and bibliography while producing
a normal Writer document that can be edited without LaTeX.
"""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

from PIL import Image
from odf.draw import Frame, Image as OdfImage
from odf.opendocument import OpenDocumentText
from odf.style import (
    FontFace,
    Footer,
    FooterStyle,
    Header,
    HeaderFooterProperties,
    HeaderStyle,
    MasterPage,
    PageLayout,
    PageLayoutProperties,
    ParagraphProperties,
    Style,
    TableCellProperties,
    TableColumnProperties,
    TableProperties,
    TextProperties,
)
from odf.table import Table, TableCell, TableColumn, TableRow
from odf.text import P, PageNumber, Span

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "CallMind_Research_Paper.tex"
BBL = ROOT / "CallMind_Research_Paper.bbl"
OUT = ROOT / "docs" / "CallMind_Research_Paper.odt"
FIG_OUT = ROOT / "docs" / "images"


def braced(text: str, command: str, start: int = 0) -> tuple[str, int]:
    marker = command + "{"
    pos = text.find(marker, start)
    if pos < 0:
        return "", start
    pos += len(marker)
    depth = 1
    i = pos
    while i < len(text) and depth:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    return text[pos : i - 1], i


def parse_bibliography() -> tuple[dict[str, str], list[tuple[str, str]]]:
    raw = BBL.read_text(encoding="utf-8")
    chunks = re.findall(
        r"\\bibitem\{([^}]+)\}(.*?)(?=\\bibitem|\Z)", raw, flags=re.S
    )
    mapping: dict[str, str] = {}
    entries: list[tuple[str, str]] = []
    for idx, (key, body) in enumerate(chunks, 1):
        mapping[key] = str(idx)
        body = re.sub(r"\\BIB[A-Za-z]+(?:\[[^\]]*\])?", " ", body)
        body = re.sub(r"\\providecommand\{[^}]+\}\[[^\]]*\]\{[^}]*\}", " ", body)
        body = re.sub(r"\\csname[^\\]*\\endcsname", " ", body)
        entries.append((key, clean_inline(body)))
    return mapping, entries


CITE_MAP: dict[str, str] = {}
REF_MAP: dict[str, str] = {}
BIB_ENTRIES: list[tuple[str, str]] = []


def build_ref_map(source: str) -> dict[str, str]:
    mapping: dict[str, str] = {}
    section = subsection = table = figure = equation = 0
    context = "body"
    for line in source.splitlines():
        s = line.strip()
        if s.startswith("\\begin{table}"):
            table += 1
            context = "table"
        elif s.startswith("\\begin{figure}"):
            figure += 1
            context = "figure"
        elif s.startswith("\\begin{equation}"):
            equation += 1
            context = "equation"
        elif s.startswith("\\section"):
            section += 1
            subsection = 0
            context = "section"
        elif s.startswith("\\subsection"):
            subsection += 1
            context = "subsection"
        for label in re.findall(r"\\label\{([^}]+)\}", s):
            if context == "table":
                mapping[label] = str(table)
            elif context == "figure":
                mapping[label] = str(figure)
            elif context == "equation":
                mapping[label] = str(equation)
            elif context == "subsection":
                mapping[label] = f"{section}.{subsection}"
            elif context == "section":
                mapping[label] = str(section)
    return mapping


def clean_inline(text: str) -> str:
    text = re.sub(r"(?<!\\)%.*", "", text)
    text = text.replace("\\noindent", " ")
    text = text.replace("\\\\", " ")
    text = re.sub(r"\\(?:textbf|textit|emph|code|texttt|mbox|mathrm|journalth)\{([^{}]*)\}", r"\1", text)
    text = re.sub(r"\\url\{([^{}]*)\}", r"\1", text)
    text = re.sub(r"\\href\{[^{}]*\}\{([^{}]*)\}", r"\1", text)

    def cite_repl(match: re.Match[str]) -> str:
        keys = [k.strip() for k in match.group(1).split(",")]
        nums = [CITE_MAP.get(k, "?") for k in keys]
        return "[" + ",".join(nums) + "]"

    text = re.sub(r"\\cite\{([^}]+)\}", cite_repl, text)
    text = re.sub(r"\\ref\{([^}]+)\}", lambda m: REF_MAP.get(m.group(1), "?"), text)
    text = re.sub(r"\\(?:vspace|hspace|setlength|label|noindent|par|newblock|relax)\b(?:\[[^\]]*\])?(?:\{[^{}]*\})?", " ", text)
    text = re.sub(r"\\journal(?:tablestyle|headrow|tablefont)|\\journalth", " ", text)
    text = re.sub(r"\\(?:hline|cline\{[^\}]*\}|toprule|midrule|bottomrule|centering|small|footnotesize|scriptsize|arraybackslash)", " ", text)
    text = re.sub(r"\\begin\{[^{}]*\}|\\end\{[^{}]*\}", " ", text)
    text = re.sub(r"\\(?:%|&|#|\$|_|\{|\})", lambda m: m.group(0)[1:], text)
    text = text.replace("\\ldots", "…").replace("\\dots", "…")
    text = text.replace("---", "—").replace("--", "–")
    text = text.replace("~", " ")
    text = re.sub(r"\\[a-zA-Z]+", " ", text)
    text = text.replace("$", "")
    text = re.sub(r"\\[,;!]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def make_style(doc: OpenDocumentText) -> dict[str, Style]:
    def para_style(name: str, *, font: str = "DejaVu Sans", size: str = "9.5pt",
                   color: str = "#003399", bold: bool = False, italic: bool = False,
                   align: str = "justify", top: str = "0pt", bottom: str = "5.5pt",
                   left: str = "0pt", indent: str = "0pt") -> Style:
        s = Style(name=name, family="paragraph")
        s.addElement(TextProperties(fontname=font, fontsize=size, color=color,
                                    fontweight="bold" if bold else "normal",
                                    fontstyle="italic" if italic else "normal"))
        s.addElement(ParagraphProperties(textalign=align, margintop=top,
                                         marginbottom=bottom, marginleft=left,
                                         textindent=indent))
        doc.styles.addElement(s)
        return s

    styles = {
        "label": para_style("label", size="23pt", bold=True, align="start", bottom="10pt"),
        "title": para_style("title", size="14pt", bold=True, align="center", bottom="12pt"),
        "author": para_style("author", bold=True, align="center", bottom="2pt"),
        "affiliation": para_style("affiliation", bold=True, align="center", bottom="5pt"),
        "email": para_style("email", color="#0084EF", align="center", bottom="1pt"),
        "separator": para_style("separator", align="center", top="2pt", bottom="4pt"),
        "abstract": para_style("abstract", bold=True, align="start", top="8pt", bottom="4pt"),
        "heading1": para_style("heading1", bold=True, align="start", top="12pt", bottom="4pt"),
        "heading2": para_style("heading2", italic=True, align="start", left="35pt", top="8pt", bottom="3pt"),
        "body": para_style("body"),
        "keywords": para_style("keywords"),
        "list": para_style("list", left="18pt", indent="-12pt", bottom="3pt"),
        "equation": para_style("equation", align="center", bottom="5pt"),
        "caption": para_style("caption", align="start", top="2pt", bottom="8pt"),
        "figure": para_style("figure", align="center", bottom="3pt"),
        "reference": para_style("reference", left="14pt", indent="-14pt", bottom="4pt"),
        "runningheader": para_style("runningheader", font="Carlito", size="11pt",
                                   color="#ED7D31", align="center", top="0pt", bottom="0pt"),
        "pagenumber": para_style("pagenumber", font="Carlito", size="8pt",
                                color="#000000", align="center", top="0pt", bottom="0pt"),
        "tablebody": para_style("tablebody", size="7.5pt", align="start", bottom="0pt"),
        "tableheader": para_style("tableheader", size="7.5pt", bold=True, align="start", bottom="0pt"),
    }

    styles["separator"].addElement(ParagraphProperties(borderbottom="0.4pt solid #003399"))

    box_table = Style(name="PageNumberBoxTable", family="table")
    box_table.addElement(TableProperties(width="39pt", align="center"))
    doc.automaticstyles.addElement(box_table)
    box_col = Style(name="PageNumberBoxColumn", family="table-column")
    box_col.addElement(TableColumnProperties(columnwidth="34pt"))
    doc.automaticstyles.addElement(box_col)
    box_cell = Style(name="PageNumberBoxCell", family="table-cell")
    box_cell.addElement(TableCellProperties(
        border="0.5pt solid #333333", padding="2pt", verticalalign="middle"))
    doc.automaticstyles.addElement(box_cell)

    italic = Style(name="headeritalic", family="text")
    italic.addElement(TextProperties(fontname="Carlito", fontsize="11pt",
                                     color="#ED7D31", fontstyle="italic"))
    doc.styles.addElement(italic)

    header_cell = Style(name="TableHeaderCell", family="table-cell")
    header_cell.addElement(TableCellProperties(
        backgroundcolor="#D0D0D0", border="0.4pt solid #B7B7B7",
        padding="0.8mm", verticalalign="top"))
    doc.automaticstyles.addElement(header_cell)

    body_cell = Style(name="TableBodyCell", family="table-cell")
    body_cell.addElement(TableCellProperties(
        border="0.4pt solid #B7B7B7", padding="0.8mm", verticalalign="top"))
    doc.automaticstyles.addElement(body_cell)

    table_style = Style(name="JournalTable", family="table")
    table_style.addElement(TableProperties(width="15.1cm", align="margins"))
    doc.automaticstyles.addElement(table_style)

    col_style = Style(name="JournalColumn", family="table-column")
    col_style.addElement(TableColumnProperties(columnwidth="2.5cm"))
    doc.automaticstyles.addElement(col_style)
    return styles


def add_paragraph(doc: OpenDocumentText, style: str, text: str) -> None:
    p = P(stylename=style, text=text)
    doc.text.addElement(p)


def render_figure(pdf: Path, stem: str) -> Path:
    FIG_OUT.mkdir(parents=True, exist_ok=True)
    target = FIG_OUT / stem
    subprocess.run(
        ["pdftoppm", "-png", "-r", "150", "-singlefile", str(pdf), str(target)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return target.with_suffix(".png")


def add_figure(doc: OpenDocumentText, block: str, number: int) -> None:
    fig = re.search(r"\\begin\{figure\}(.*?)\\end\{figure\}", block, re.S).group(1)
    img_match = re.search(r"\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}", fig)
    cap_match = re.search(r"\\caption\{", fig)
    caption = ""
    if cap_match:
        caption, _ = braced(fig, "\\caption", cap_match.start())
    if img_match:
        pdf = ROOT / img_match.group(1)
        png = render_figure(pdf, pdf.stem)
        with Image.open(png) as im:
            width_px, height_px = im.size
        width_cm = 15.0
        height_cm = width_cm * height_px / width_px
        href = doc.addPictureFromFile(str(png))
        frame = Frame(width=f"{width_cm:.2f}cm", height=f"{height_cm:.2f}cm",
                      anchortype="as-char")
        frame.addElement(OdfImage(href=href, type="simple", show="embed", actuate="onLoad"))
        p = P(stylename="figure")
        p.addElement(frame)
        doc.text.addElement(p)
    if caption:
        add_paragraph(doc, "caption", f"Figure {number}. " + clean_inline(caption))


def add_table(doc: OpenDocumentText, block: str, number: int) -> None:
    tbl = re.search(r"\\begin\{table\}(.*?)\\end\{table\}", block, re.S).group(1)
    cap_match = re.search(r"\\caption\{", tbl)
    if cap_match:
        caption, _ = braced(tbl, "\\caption", cap_match.start())
        add_paragraph(doc, "caption", f"Table {number}. " + clean_inline(caption))
    tab = re.search(
        r"\\begin\{tabular\*?\}(?:\[[^\]]*\])?"
        r"((?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}){1,2})"
        r"(.*?)\\end\{tabular\*?\}", tbl, re.S)
    if not tab:
        return
    widths = [f"{float(w):.2f}cm" for w in re.findall(r"p\{([\d.]+)cm\}", tab.group(1))]
    rows = []
    for raw_row in re.split(r"\\\\", tab.group(2)):
        raw_row = re.sub(r"\\(?:hline|journalheadrow|toprule|midrule|bottomrule)", "", raw_row)
        cells = [clean_inline(c) for c in raw_row.split("&")]
        if any(c for c in cells):
            rows.append(cells)
    if not rows:
        return
    ncols = max(len(r) for r in rows)
    table = Table(name="JournalTableInstance", stylename="JournalTable")
    for cidx in range(ncols):
        width = widths[cidx] if cidx < len(widths) else "2.5cm"
        col_style = Style(name=f"JournalColumn{number}_{cidx}", family="table-column")
        col_style.addElement(TableColumnProperties(columnwidth=width))
        doc.automaticstyles.addElement(col_style)
        table.addElement(TableColumn(stylename=col_style))
    for ridx, row in enumerate(rows):
        tr = TableRow()
        for cidx in range(ncols):
            value = row[cidx] if cidx < len(row) else ""
            is_header = ridx == 0
            tc = TableCell(valuetype="string",
                           stylename="TableHeaderCell" if is_header else "TableBodyCell")
            tc.addElement(P(stylename="tableheader" if is_header else "tablebody", text=value))
            tr.addElement(tc)
        table.addElement(tr)
    doc.text.addElement(table)


def add_list(doc: OpenDocumentText, block: str) -> None:
    env = "enumerate" if "\\begin{enumerate}" in block else "itemize"
    body = re.search(rf"\\begin\{{{env}\}}(.*?)\\end\{{{env}\}}", block, re.S).group(1)
    counter = 0
    for raw in re.split(r"\\item", body)[1:]:
        label = ""
        lm = re.match(r"\s*\[([^\]]+)\]", raw)
        if lm:
            label = lm.group(1)
            raw = raw[lm.end():]
        else:
            counter += 1
            label = str(counter) if env == "enumerate" else "•"
        add_paragraph(doc, "list", f"{label}  {clean_inline(raw)}")


def add_equation(doc: OpenDocumentText, block: str, number: int) -> None:
    body = re.search(r"\\begin\{equation\}(.*?)\\end\{equation\}", block, re.S).group(1)
    body = re.sub(r"\\label\{[^}]*\}", "", body)
    add_paragraph(doc, "equation", f"{clean_inline(body)}    ({number})")


def parse_masthead(text: str) -> dict[str, object]:
    title, _ = braced(text, "\\JournalTitle")
    authors = []
    pos = 0
    while True:
        value, pos = braced(text, "\\JournalAuthor", pos)
        if not value or pos == 0:
            break
        authors.append(clean_inline(value))
    affils = []
    pos = 0
    while True:
        value, pos = braced(text, "\\JournalAffiliation", pos)
        if not value:
            break
        affils.append(clean_inline(value))
    emails = []
    pos = 0
    while True:
        value, pos = braced(text, "\\JournalEmail", pos)
        if not value:
            break
        emails.append(clean_inline(value))
    return {"title": clean_inline(title), "authors": authors,
            "affiliations": affils, "emails": emails}


def main() -> None:
    global CITE_MAP, REF_MAP, BIB_ENTRIES
    CITE_MAP, BIB_ENTRIES = parse_bibliography()
    REF_MAP = build_ref_map(SOURCE.read_text(encoding="utf-8"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    source = SOURCE.read_text(encoding="utf-8")
    masthead = parse_masthead(source)
    body_start = source.find("\\section*{Abstract}")
    body = source[body_start:]

    doc = OpenDocumentText()
    for face, generic, pitch in (
        ("DejaVu Sans", "swiss", "variable"),
        ("DejaVu Sans Mono", "modern", "fixed"),
        ("Carlito", "swiss", "variable"),
    ):
        doc.fontfacedecls.addElement(FontFace(
            name=face, fontfamily=face, fontfamilygeneric=generic, fontpitch=pitch))

    layout = PageLayout(name="A4Journal")
    layout.addElement(PageLayoutProperties(
        pagewidth="21cm", pageheight="29.7cm", margintop="2.6cm",
        marginbottom="2.6cm", marginleft="3cm", marginright="2.9cm"))
    doc.automaticstyles.addElement(layout)
    header_style = HeaderStyle()
    header_style.addElement(HeaderFooterProperties(minheight="14pt", marginbottom="4pt"))
    layout.addElement(header_style)
    footer_style = FooterStyle()
    footer_style.addElement(HeaderFooterProperties(minheight="34pt", margintop="4pt"))
    layout.addElement(footer_style)
    master = MasterPage(name="Standard", pagelayoutname=layout)
    doc.masterstyles.addElement(master)

    styles = make_style(doc)
    assert styles

    header = Header()
    hp = P(stylename="runningheader")
    hp.addElement(Span(stylename="headeritalic", text="CallMind Intelligence"))
    hp.addElement(Span(text=", Mini Project–II Research Paper"))
    header.addElement(hp)
    master.addElement(header)
    footer = Footer()
    box = Table(name="PageNumberBox", stylename="PageNumberBoxTable")
    box.addElement(TableColumn(stylename="PageNumberBoxColumn"))
    row = TableRow()
    cell = TableCell(valuetype="string", stylename="PageNumberBoxCell")
    fp = P(stylename="pagenumber")
    fp.addElement(PageNumber(selectpage="current"))
    cell.addElement(fp)
    row.addElement(cell)
    box.addElement(row)
    footer.addElement(box)
    master.addElement(footer)

    add_paragraph(doc, "label", "Research paper")
    add_paragraph(doc, "title", str(masthead["title"]))
    for author in masthead["authors"]:
        add_paragraph(doc, "author", author)
    for affil in masthead["affiliations"]:
        add_paragraph(doc, "affiliation", affil)
    add_paragraph(doc, "separator", "")
    for email in masthead["emails"]:
        add_paragraph(doc, "email", email)

    lines = body.splitlines()
    i = 0
    section_no = 0
    subsection_no = 0
    equation_no = 0
    table_no = 0
    figure_no = 0
    special = ("\\begin{table}", "\\begin{figure}", "\\begin{equation}",
               "\\begin{enumerate}", "\\begin{itemize}", "\\section",
               "\\subsection", "\\bibliography")

    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("\\begin{table}"):
            j = i
            while "\\end{table}" not in lines[j]:
                j += 1
            table_no += 1
            add_table(doc, "\n".join(lines[i : j + 1]), table_no)
            i = j + 1
            continue
        if line.startswith("\\begin{figure}"):
            j = i
            while "\\end{figure}" not in lines[j]:
                j += 1
            figure_no += 1
            add_figure(doc, "\n".join(lines[i : j + 1]), figure_no)
            i = j + 1
            continue
        if line.startswith("\\begin{equation}"):
            j = i
            while "\\end{equation}" not in lines[j]:
                j += 1
            equation_no += 1
            add_equation(doc, "\n".join(lines[i : j + 1]), equation_no)
            i = j + 1
            continue
        if line.startswith("\\begin{enumerate}") or line.startswith("\\begin{itemize}"):
            env = "enumerate" if "enumerate" in line else "itemize"
            j = i
            while f"\\end{{{env}}}" not in lines[j]:
                j += 1
            add_list(doc, "\n".join(lines[i : j + 1]))
            i = j + 1
            continue
        if line.startswith("\\section"):
            match = re.search(r"\\section\*?\{([^}]*)\}", line)
            title = clean_inline(match.group(1)) if match else ""
            if line.startswith("\\section*"):
                add_paragraph(doc, "abstract", title)
            else:
                section_no += 1
                subsection_no = 0
                add_paragraph(doc, "heading1", f"{section_no}. {title}")
            i += 1
            continue
        if line.startswith("\\subsection"):
            match = re.search(r"\\subsection\{([^}]*)\}", line)
            title = clean_inline(match.group(1)) if match else ""
            subsection_no += 1
            add_paragraph(doc, "heading2", f"{section_no}.{subsection_no}. {title}")
            i += 1
            continue
        if line.startswith("\\bibliography"):
            add_paragraph(doc, "heading1", "References")
            for idx, (_, entry) in enumerate(BIB_ENTRIES, 1):
                add_paragraph(doc, "reference", f"[{idx}] {entry}")
            i += 1
            continue

        para = [line]
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if not nxt or nxt.startswith(special):
                break
            para.append(nxt)
            i += 1
        text = clean_inline(" ".join(para))
        if not text:
            continue
        style = "keywords" if text.startswith("Keywords:") else "body"
        add_paragraph(doc, style, text)

    doc.save(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
