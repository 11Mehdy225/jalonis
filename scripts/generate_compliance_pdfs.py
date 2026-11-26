#!/usr/bin/env python3
from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
LOGO = ROOT / "public" / "assets" / "kavelyo-logo.png"

SOURCES = [
    ("POLITIQUE_SECURITE_INFORMATION.md", "Politique_securite_information_Kavelyo.pdf"),
    ("POLITIQUE_CONSERVATION_DONNEES.md", "Politique_conservation_donnees_Kavelyo.pdf"),
    ("REGISTRE_TRAITEMENTS_DONNEES.md", "Registre_traitements_donnees_Kavelyo.pdf"),
    ("PROCEDURE_INCIDENTS_DONNEES.md", "Procedure_incidents_donnees_Kavelyo.pdf"),
]

INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#667085")
PURPLE = colors.HexColor("#5147E5")
PURPLE_PALE = colors.HexColor("#F1F0FF")
LINE = colors.HexColor("#DDE2EA")


def inline(value: str) -> str:
    escaped = html.escape(value.strip())
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"`(.+?)`", r"<font name='Courier'>\1</font>", escaped)
    return escaped


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=23,
            leading=28, textColor=INK, spaceAfter=10 * mm, alignment=TA_LEFT,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13.5,
            leading=17, textColor=PURPLE, spaceBefore=5 * mm, spaceAfter=2.5 * mm,
        ),
        "body": ParagraphStyle(
            "Body", parent=base["BodyText"], fontName="Helvetica", fontSize=9.5,
            leading=14, textColor=INK, spaceAfter=2.5 * mm,
        ),
        "meta": ParagraphStyle(
            "Meta", parent=base["BodyText"], fontName="Helvetica", fontSize=8.8,
            leading=12.5, textColor=MUTED, spaceAfter=1 * mm,
        ),
        "bullet": ParagraphStyle(
            "Bullet", parent=base["BodyText"], fontName="Helvetica", fontSize=9.3,
            leading=13.5, textColor=INK, leftIndent=5 * mm, firstLineIndent=0,
            bulletIndent=0, spaceAfter=1.2 * mm,
        ),
        "table_head": ParagraphStyle(
            "TableHead", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=8.4,
            leading=10.5, textColor=colors.white,
        ),
        "table": ParagraphStyle(
            "Table", parent=base["BodyText"], fontName="Helvetica", fontSize=7.8,
            leading=10.2, textColor=INK,
        ),
        "cover_brand": ParagraphStyle(
            "CoverBrand", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=11,
            leading=14, textColor=PURPLE, alignment=TA_CENTER,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=base["Title"], fontName="Helvetica-Bold", fontSize=28,
            leading=34, textColor=INK, alignment=TA_CENTER,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub", parent=base["BodyText"], fontName="Helvetica", fontSize=11,
            leading=16, textColor=MUTED, alignment=TA_CENTER,
        ),
    }


STYLES = styles()


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, height - 17 * mm, width - 18 * mm, height - 17 * mm)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(PURPLE)
    canvas.drawString(18 * mm, height - 12 * mm, "KAVELYO  |  RONNA GROUP")
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 18 * mm, 11 * mm, f"Document de conformité  |  Page {doc.page}")
    canvas.drawString(18 * mm, 11 * mm, "Version 1.0 - 24 novembre 2026")
    canvas.restoreState()


def table_story(rows):
    cooked = []
    for index, row in enumerate(rows):
        style = STYLES["table_head"] if index == 0 else STYLES["table"]
        cooked.append([Paragraph(inline(cell), style) for cell in row])
    available = A4[0] - 36 * mm
    columns = len(rows[0])
    widths = [available / columns] * columns
    table = Table(cooked, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9FC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def markdown_to_story(path: Path, include_title=True):
    lines = path.read_text(encoding="utf-8").splitlines()
    story = []
    table_rows = []
    intro = True

    def flush_table():
        nonlocal table_rows
        if table_rows:
            story.append(table_story(table_rows))
            story.append(Spacer(1, 3 * mm))
            table_rows = []

    for raw in lines:
        line = raw.strip()
        if line.startswith("|") and line.endswith("|"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
                continue
            table_rows.append(cells)
            continue
        flush_table()
        if not line:
            story.append(Spacer(1, 1.5 * mm))
            continue
        if line.startswith("# "):
            if include_title:
                story.append(Paragraph(inline(line[2:]), STYLES["title"]))
            intro = True
        elif line.startswith("## "):
            story.append(Paragraph(inline(line[3:]), STYLES["h2"]))
            intro = False
        elif line.startswith("- "):
            story.append(Paragraph(inline(line[2:]), STYLES["bullet"], bulletText="•"))
        else:
            selected = STYLES["meta"] if intro and line.startswith("**") else STYLES["body"]
            story.append(Paragraph(inline(line.replace("  ", " ")), selected))
    flush_table()
    return story


def document(path: Path, title: str, with_cover=False):
    frame = Frame(18 * mm, 18 * mm, A4[0] - 36 * mm, A4[1] - 45 * mm, id="normal")
    cover_frame = Frame(18 * mm, 18 * mm, A4[0] - 36 * mm, A4[1] - 36 * mm, id="cover")
    doc = BaseDocTemplate(
        str(path), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=21 * mm, bottomMargin=18 * mm, title=title,
        author="RONNA GROUP", subject="Conformité et protection des données Kavelyo",
    )
    if with_cover:
        doc.addPageTemplates([
            PageTemplate(id="cover", frames=[cover_frame]),
            PageTemplate(id="content", frames=[frame], onPage=header_footer),
        ])
    else:
        doc.addPageTemplates(PageTemplate(id="content", frames=[frame], onPage=header_footer))
    return doc


def cover_story():
    elements = [Spacer(1, 32 * mm)]
    if LOGO.exists():
        logo = Image(str(LOGO), width=28 * mm, height=28 * mm)
        logo.hAlign = "CENTER"
        elements.extend([logo, Spacer(1, 7 * mm)])
    elements.extend([
        Paragraph("KAVELYO", STYLES["cover_brand"]),
        Spacer(1, 5 * mm),
        Paragraph("Dossier de conformité<br/>et de protection des données", STYLES["cover_title"]),
        Spacer(1, 8 * mm),
        Paragraph("Politiques internes, registre des traitements et procédure de gestion des incidents", STYLES["cover_sub"]),
        Spacer(1, 18 * mm),
        Table([
            [Paragraph("Éditeur", STYLES["table"]), Paragraph("RONNA GROUP SARLU", STYLES["table"])],
            [Paragraph("Version", STYLES["table"]), Paragraph("1.0 - 24 novembre 2026", STYLES["table"])],
            [Paragraph("Contact", STYLES["table"]), Paragraph("contact@ronnagroup.net", STYLES["table"])],
        ], colWidths=[42 * mm, 92 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), PURPLE_PALE),
            ("GRID", (0, 0), (-1, -1), 0.5, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ])),
        Spacer(1, 16 * mm),
        Paragraph("Document opérationnel à faire relire par un conseil compétent et à compléter avec les références délivrées par l'ARTCI.", STYLES["cover_sub"]),
        NextPageTemplate("content"),
        PageBreak(),
    ])
    return elements


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for source_name, output_name in SOURCES:
        source = ROOT / "docs" / source_name
        target = OUTPUT / output_name
        story = markdown_to_story(source)
        document(target, source.stem.replace("_", " ").title()).build(story)

    combined = OUTPUT / "Dossier_conformite_Kavelyo.pdf"
    story = cover_story()
    for index, (source_name, _) in enumerate(SOURCES):
        story.extend(markdown_to_story(ROOT / "docs" / source_name))
        if index < len(SOURCES) - 1:
            story.append(PageBreak())
    document(combined, "Dossier de conformité Kavelyo", with_cover=True).build(story)
    print(f"Generated {len(SOURCES) + 1} PDFs in {OUTPUT}")


if __name__ == "__main__":
    main()
