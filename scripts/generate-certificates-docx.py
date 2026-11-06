#!/usr/bin/env python3
"""
Certificats vierges au format WORD, un par école.

Contrairement au PDF (où l'on remplit des champs), le fichier Word est
entièrement éditable : vous pouvez changer les textes, les couleurs, ajouter
un logo ou une signature scannée, puis imprimer.

Les données (nom de l'école, slogan, couleur, directeur) viennent de la base,
via le fichier JSON produit par `scripts/dump-schools.mjs`.

Usage :
    node scripts/dump-schools.mjs && python3 scripts/generate-certificates-docx.py

Dépendance : pip install python-docx
"""
import json
import os
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHOOLS_JSON = os.path.join(ROOT, "scripts", ".tmp", "schools.json")
OUT_DIR = "/home/user/certificats-vierges/word"

NIGHT = "101B3D"
GREY = "737A94"
LIGHT = "99A0B0"


def hex_color(value, fallback="2563EB"):
    """« #16A34A » → « 16A34A », avec repli sûr."""
    clean = (value or "").strip().lstrip("#")
    return clean if len(clean) == 6 and all(c in "0123456789abcdefABCDEF" for c in clean) else fallback


def set_bottom_border(paragraph, color, size=8):
    """Trait de couleur sous un paragraphe (filet, ligne à remplir)."""
    pPr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), color)
    borders.append(bottom)
    pPr.append(borders)


def paragraph(document, text="", size=11, bold=False, italic=False, color=None,
              align="left", space_after=6, space_before=0, font="Calibri"):
    p = document.add_paragraph()
    p.alignment = {
        "left": WD_ALIGN_PARAGRAPH.LEFT,
        "center": WD_ALIGN_PARAGRAPH.CENTER,
        "right": WD_ALIGN_PARAGRAPH.RIGHT,
    }[align]
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.name = font
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    return p


def blank_line(document, color=NIGHT, space_after=0):
    """Ligne vide à remplir à la main (ou à la machine)."""
    p = document.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    set_bottom_border(p, color, size=6)
    return p


def landscape_a4(document):
    section = document.sections[0]
    section.orientation = 1  # paysage
    section.page_width, section.page_height = Cm(29.7), Cm(21.0)
    section.left_margin = section.right_margin = Cm(1.6)
    section.top_margin = Cm(1.2)
    section.bottom_margin = Cm(1.0)


def build(school, path):
    accent = hex_color(school.get("accent"))
    name = (school.get("name_fr") or "École").upper()
    tagline = school.get("tagline_fr") or ""
    role = school.get("director_role") or "Directeur"
    civility = "La" if role.lower().startswith(("directrice", "responsable")) else "Le"

    document = Document()
    landscape_a4(document)
    style = document.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    # --- En-tête : école à gauche, plateforme à droite --------------------
    header = document.add_table(rows=1, cols=2)
    header.alignment = WD_TABLE_ALIGNMENT.CENTER
    left, right = header.rows[0].cells
    left.width, right.width = Cm(16), Cm(11)

    p = left.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(name)
    run.font.size = Pt(20)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(accent)

    p = left.add_paragraph()
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(tagline)
    run.font.size = Pt(9)
    run.font.italic = True
    run.font.color.rgb = RGBColor.from_string(GREY)

    p = right.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("DIGINIGER")
    run.font.size = Pt(13)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(NIGHT)

    p = right.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("Plateforme de formation certifiante · République du Niger")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(LIGHT)

    separator = document.add_paragraph()
    separator.paragraph_format.space_before = Pt(4)
    separator.paragraph_format.space_after = Pt(2)
    set_bottom_border(separator, accent, size=12)

    paragraph(document, "MODÈLE VIERGE — à compléter puis à imprimer",
              size=8, color=LIGHT, align="right", space_after=2)

    # --- Corps -------------------------------------------------------------
    paragraph(document, "CERTIFICAT DE RÉUSSITE", size=26, bold=True,
              color=NIGHT, align="center", space_before=10, space_after=4)
    paragraph(document, "Décerné à", size=10, color=GREY, align="center", space_after=4)

    blank_line(document, color=NIGHT)
    paragraph(document, "Nom et prénom de l'apprenant", size=8, italic=True,
              color=LIGHT, align="center", space_after=8)

    paragraph(document, "pour avoir suivi et validé avec succès la formation",
              size=11, color=GREY, align="center", space_after=6)

    blank_line(document, color=accent)
    paragraph(document, "Intitulé de la formation", size=8, italic=True,
              color=LIGHT, align="center", space_after=8)

    paragraph(document, "Formation validée — cours, travaux pratiques et évaluations.",
              size=10, italic=True, color=GREY, align="center", space_after=14)

    # --- Pied : références à gauche, signature à droite -------------------
    footer_table = document.add_table(rows=1, cols=3)
    footer_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell_left, cell_center, cell_right = footer_table.rows[0].cells
    cell_left.width, cell_center.width, cell_right.width = Cm(9), Cm(9), Cm(9)

    p = cell_left.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("Date d'obtention : ______________________")
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor.from_string(GREY)

    p = cell_left.add_paragraph()
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("Numéro : __________________________")
    run.font.size = Pt(10)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(NIGHT)

    p = cell_center.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("(Emplacement réservé au QR code\nde vérification)")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(LIGHT)

    p = cell_right.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(f"{civility} {role}")
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor.from_string(GREY)

    # Aucun nom de personne n'est imprimé : une ligne à signer à la main.
    spacer = cell_right.add_paragraph()
    spacer.paragraph_format.space_after = Pt(0)
    run = spacer.add_run("")
    run.font.size = Pt(16)

    sign = cell_right.add_paragraph()
    sign.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    sign.paragraph_format.space_after = Pt(2)
    set_bottom_border(sign, LIGHT, size=4)

    p = cell_right.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(school.get("name_fr") or "")
    run.font.size = Pt(8)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(GREY)

    paragraph(
        document,
        f"Document émis par DIGINIGER — Académie numérique intelligente · "
        f"{school.get('name_fr') or ''} · Niamey, Niger",
        size=7,
        color=LIGHT,
        align="center",
        space_before=10,
        space_after=0,
    )

    document.save(path)
    return path


def main():
    if not os.path.exists(SCHOOLS_JSON):
        print("Fichier d'écoles introuvable. Lancez d'abord : node scripts/dump-schools.mjs", file=sys.stderr)
        sys.exit(1)

    with open(SCHOOLS_JSON, encoding="utf-8") as handle:
        schools = json.load(handle)

    os.makedirs(OUT_DIR, exist_ok=True)
    for school in schools:
        path = os.path.join(OUT_DIR, f"certificat-vierge-{school['slug']}.docx")
        build(school, path)
        print(f"  ✔ {school['name_fr']} → {path}")

    print(f"\n{len(schools)} certificats Word générés dans {OUT_DIR}")


if __name__ == "__main__":
    main()
