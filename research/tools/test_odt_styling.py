#!/usr/bin/env python3
"""Regression check for the CallMind ODT/DOCX styling."""
import re
import subprocess
import zipfile
from pathlib import Path

ROOT = Path("/home/sachindjaiswal/newStudent/callMind/research/docs")
ODT = ROOT / "CallMind_Research_Paper.odt"
PDF = ROOT / "CallMind_Research_Paper.pdf"

failures = []

with zipfile.ZipFile(ODT) as z:
    content = z.read("content.xml").decode("utf-8")
    styles = z.read("styles.xml").decode("utf-8")

for face in ("DejaVu Sans", "Carlito"):
    if f'style:name="{face}"' not in content + styles:
        failures.append(f"missing font-face declaration: {face}")

if "<style:header>" not in styles:
    failures.append("missing running header in master page")
if "<style:footer>" not in styles:
    failures.append("missing boxed footer in master page")
if "CallMind Intelligence" not in styles:
    failures.append("running header text missing from master page")

fonts = subprocess.run(["pdffonts", str(PDF)], capture_output=True, text=True).stdout
if "LiberationSerif" in fonts:
    failures.append("rendered PDF still contains LiberationSerif fallback")
if "DejaVuSans" not in fonts:
    failures.append("rendered PDF missing DejaVu Sans body font")
if "Carlito" not in fonts and "NotoSans" not in fonts:
    failures.append("rendered PDF missing Calibri-like header font")

if failures:
    print("FAIL")
    for f in failures:
        print(" -", f)
    raise SystemExit(1)
print("PASS")
