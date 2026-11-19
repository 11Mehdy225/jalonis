from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.style import WD_STYLE_TYPE
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "Cahier_des_charges_et_guide_utilisation_Jalonis.docx"
LOGO = ROOT / "public" / "assets" / "jalonis-logo.png"

NAVY = "172039"
INDIGO = "4F46E5"
TEAL = "159985"
LIGHT = "F3F5F9"
PALE = "EEF0FF"
MID = "687086"
BORDER = "D9D9D9"
WHITE = "FFFFFF"
BLACK = "000000"

doc = Document()
section = doc.sections[0]
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(0.72)
section.bottom_margin = Inches(0.68)
section.left_margin = Inches(0.78)
section.right_margin = Inches(0.78)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Aptos"
normal.font.size = Pt(10.5)
normal.font.color.rgb = RGBColor.from_string("252D43")
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.12

for style_name, size, before, after in [
    ("Title", 28, 0, 12), ("Heading 1", 20, 16, 8),
    ("Heading 2", 14, 12, 6), ("Heading 3", 11.5, 9, 4),
]:
    st = styles[style_name]
    st.font.name = "Aptos Display"
    st.font.size = Pt(size)
    st.font.bold = True
    st.font.color.rgb = RGBColor.from_string(BLACK)
    st.paragraph_format.space_before = Pt(before)
    st.paragraph_format.space_after = Pt(after)
    st.paragraph_format.keep_with_next = True

title_ppr = styles["Title"]._element.get_or_add_pPr()
title_border = title_ppr.find(qn("w:pBdr"))
if title_border is not None:
    title_ppr.remove(title_border)

if "Caption Small" not in styles:
    cap = styles.add_style("Caption Small", WD_STYLE_TYPE.PARAGRAPH)
    cap.font.name = "Aptos"
    cap.font.size = Pt(8.5)
    cap.font.color.rgb = RGBColor.from_string(MID)
    cap.paragraph_format.space_after = Pt(5)

def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)

def set_cell_margins(cell, top=90, start=100, bottom=90, end=100):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")

def set_cell_border(cell, color=BORDER, size="5"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = qn(f"w:{edge}")
        el = borders.find(tag)
        if el is None:
            el = OxmlElement(f"w:{edge}")
            borders.append(el)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), size)
        el.set(qn("w:color"), color)

def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)

def table(headers, rows, widths=None, font_size=8.6):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    set_repeat_table_header(t.rows[0])
    for i, text in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = text
        set_cell_shading(cell, NAVY)
        set_cell_border(cell)
        set_cell_margins(cell, 100, 110, 100, 110)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        for run in cell.paragraphs[0].runs:
            run.font.bold = True
            run.font.color.rgb = RGBColor.from_string(WHITE)
            run.font.size = Pt(font_size)
    for r_idx, row in enumerate(rows):
        cells = t.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = str(value)
            set_cell_border(cells[i])
            set_cell_margins(cells[i], 95, 110, 95, 110)
            cells[i].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            if r_idx % 2:
                set_cell_shading(cells[i], "F7F8FB")
            for p in cells[i].paragraphs:
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.05
                for run in p.runs:
                    run.font.size = Pt(font_size)
    if widths:
        for row in t.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    return t

def bullet(text, level=0):
    p = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
    p.add_run(text)
    p.paragraph_format.space_after = Pt(3)
    return p

def numbered(text):
    p = doc.add_paragraph(style="List Number")
    p.add_run(text)
    p.paragraph_format.space_after = Pt(3)
    return p

def p(text="", bold_lead=None):
    para = doc.add_paragraph()
    if bold_lead and text.startswith(bold_lead):
        para.add_run(bold_lead).bold = True
        para.add_run(text[len(bold_lead):])
    else:
        para.add_run(text)
    return para

def page_break():
    doc.add_page_break()

def add_page_field(paragraph):
    run = paragraph.add_run()
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.extend([fld_char1, instr, fld_char2])

# Footer
footer = section.footer
ft = footer.add_table(rows=1, cols=3, width=Inches(6.94))
ft.columns[0].width = Inches(2.4)
ft.columns[1].width = Inches(2.2)
ft.columns[2].width = Inches(2.34)
ft.cell(0, 0).text = "Jalonis 0.2.0"
ft.cell(0, 1).text = "Cahier des charges et guide"
ft.cell(0, 2).paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
ft.cell(0, 2).paragraphs[0].add_run("Page ")
add_page_field(ft.cell(0, 2).paragraphs[0])
for cell in ft.rows[0].cells:
    for run in cell.paragraphs[0].runs:
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor.from_string(MID)

# Cover
cover = doc.add_paragraph()
cover.alignment = WD_ALIGN_PARAGRAPH.CENTER
cover.paragraph_format.space_before = Pt(34)
cover.add_run().add_picture(str(LOGO), width=Inches(1.25))
title = doc.add_paragraph(style="Title")
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.add_run("Cahier des charges et guide d utilisation de Jalonis")
subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = subtitle.add_run("Application macOS et Windows de pilotage prédictif Scrum et hybride")
r.font.size = Pt(15)
r.font.color.rgb = RGBColor.from_string(MID)
subtitle.paragraph_format.space_after = Pt(28)
meta = table(["Document", "Valeur"], [
    ["Produit", "Jalonis"], ["Version couverte", "0.2.0"],
    ["Plateforme", "macOS Apple Silicon et Windows x64"], ["Stockage", "SQLite local hors ligne"],
    ["Public", "Chef de projet Product Owner Scrum Master équipe projet et développeurs"],
    ["Statut", "Spécification fonctionnelle et manuel utilisateur"],
], [1.55, 5.0], 9.2)
p("Ce document définit le périmètre fonctionnel, les règles métier, les interfaces, les liaisons entre les objets et les parcours d’utilisation de Jalonis. Il sert à la fois de référence pour poursuivre le développement et de manuel pour exploiter la version actuelle.")

page_break()
doc.add_heading("Sommaire", level=1)
toc_items = [
    "1 Présentation et objectifs", "2 Utilisateurs et responsabilités", "3 Périmètre fonctionnel",
    "4 Architecture des interfaces", "5 Modèle de données et liaisons", "6 Guide de démarrage",
    "7 Gestion prédictive et planning", "8 Gestion Scrum", "9 Pilotage hybride",
    "10 Fournisseurs et achats", "11 Risques équipe et réunions", "12 Règles métier", "13 Exigences non fonctionnelles",
    "14 Architecture technique et données locales", "15 Installation sauvegarde et maintenance",
    "16 Recette et critères d acceptation", "17 Feuille de route", "18 Glossaire",
]
for item in toc_items:
    bullet(item)

doc.add_heading("Lecture rapide", level=2)
p("Les sections 1 à 5 décrivent ce que le produit doit faire. Les sections 6 à 10 expliquent comment l’utiliser. Les sections 11 à 16 cadrent les règles, la qualité attendue et les prochaines versions.")

page_break()
doc.add_heading("1 Présentation et objectifs", level=1)
doc.add_heading("1.1 Contexte", level=2)
p("Jalonis est une application de bureau conçue pour un chef de projet qui souhaite centraliser le pilotage sans dépendre d’un service en ligne. Elle couvre le projet depuis la charte jusqu’à la clôture et combine les pratiques prédictives, Scrum et hybrides.")
p("Le produit répond à une difficulté courante : les tâches sont souvent gérées dans un outil, les risques dans un tableur, les décisions dans des comptes rendus et les responsabilités dans des notes séparées. Jalonis rassemble ces informations dans une base locale et les relie.")
doc.add_heading("1.2 Objectifs du produit", level=2)
for text in [
    "Créer et piloter plusieurs projets dans une seule application.",
    "Relier le périmètre, le calendrier, les ressources, les risques, les réunions et les décisions.",
    "Donner une lecture prédictive avec WBS, Gantt, dépendances, jalons, chemin critique et baseline.",
    "Permettre l’exécution Scrum avec Product Goal, Product Backlog, sprints, Story Points et tableau de flux.",
    "Fournir un mode hybride où les éléments Scrum contribuent au planning directeur et à la gouvernance PMP.",
    "Gérer les fournisseurs, les consultations, les offres, les contrats, les documents et la performance.",
    "Conserver les données sur l ordinateur et permettre une utilisation hors ligne.",
]: bullet(text)
doc.add_heading("1.3 Principes de conception", level=2)
table(["Principe", "Conséquence dans le produit"], [
    ["Local par défaut", "Les informations sont stockées dans SQLite sur le Mac ou le PC Windows."],
    ["Une information une source", "Une activité ou un risque est créé une seule fois puis lié aux autres objets."],
    ["Traçabilité", "Les dates prévues réelles et de référence restent distinguées."],
    ["Simplicité", "Chaque écran répond à une intention de pilotage identifiable."],
    ["Hybridation contrôlée", "La gouvernance prédictive et l’exécution Scrum sont reliées sans être confondues."],
], [1.7, 4.85])

page_break()
doc.add_heading("2 Utilisateurs et responsabilités", level=1)
table(["Rôle", "Besoins principaux", "Interfaces utilisées"], [
    ["Chef de projet", "Charte calendrier budget risques ressources décisions reporting", "Vue d ensemble Charte Planning Risques Réunions"],
    ["Responsable achats", "Sourcing consultation comparaison contractualisation conformité performance", "Fournisseurs et Achats Planning Risques"],
    ["Sponsor", "Objectifs santé jalons alertes et décisions majeures", "Vue d ensemble et rapports futurs"],
    ["Product Owner", "Product Goal ordre du backlog valeur et critères d acceptation", "Agile et Sprints Product Backlog"],
    ["Scrum Master", "Sprint Goal flux obstacles et amélioration continue", "Tableau Sprint Indicateurs Rétrospective"],
    ["Membre de l équipe", "Travail assigné échéances priorités et Definition of Done", "Planning Tableau Scrum Calendrier"],
    ["Administrateur local", "Installation sauvegarde restauration et maintenance", "Paramètres et dossier de données"],
], [1.15, 2.75, 2.65])

doc.add_heading("3 Périmètre fonctionnel", level=1)
doc.add_heading("3.1 Fonctions disponibles dans la version 0.2.0", level=2)
table(["Domaine", "Fonctions"], [
    ["Portefeuille", "Création et sélection de plusieurs projets état avancement risques ouverts."],
    ["Charte", "Code description sponsor manager objectif critères de succès dates statut et méthode."],
    ["Tableau de bord", "Avancement échéance budget risques santé trajectoire et prochaines échéances."],
    ["Planning", "Liste calendrier mensuel Gantt WBS jalons dépendances couleurs baseline et dates réelles."],
    ["Ressources", "Membres rôles compétences disponibilité travail estimé et alerte de surcharge."],
    ["Risques", "Catégorie probabilité impact score réponse propriétaire statut et activité liée."],
    ["Réunions", "Objet date participants ordre du jour décisions actions et activité liée."],
    ["Scrum", "Product Goal Definition of Done sprints backlog Story Points tableau burndown et vélocité."],
    ["Fournisseurs", "Qualification RFI RFQ RFP offres contrats documents échéances et évaluations."],
    ["Stockage", "Base SQLite locale initialisée automatiquement et fonctionnement hors ligne."],
], [1.35, 5.2])
doc.add_heading("3.2 Fonctions prévues", level=2)
for text in [
    "Plusieurs prédécesseurs par activité et calendriers ouvrés personnalisés.",
    "Sous-tâches repliables et nivellement automatique des ressources.",
    "Coûts réels gestion de la valeur acquise et projections à terminaison.",
    "Registre des changements problèmes décisions et leçons apprises.",
    "RACI parties prenantes communications conflits et matrice de compétences.",
    "Champs personnalisés import export PDF Excel et sauvegardes chiffrées.",
    "Collaboration réseau facultative droits utilisateurs et journal d audit.",
]: bullet(text)
doc.add_heading("3.3 Limites actuelles", level=2)
p("La version actuelle est un MVP local. Une activité accepte un prédécesseur principal. Le chemin critique est calculé à partir de la chaîne de dépendances disponible. Le burndown représente l’état courant du sprint ; un historique quotidien complet sera ajouté. Les installateurs de test ne sont pas encore signés numériquement ; la notarisation Apple reste nécessaire pour une diffusion commerciale sur macOS.")

doc.add_heading("4 Architecture des interfaces", level=1)
doc.add_heading("4.1 Structure générale", level=2)
p("L’écran est composé de trois zones permanentes : une barre latérale pour changer de module, un en-tête pour la recherche et la création de projets, puis une zone centrale qui affiche le contenu du projet actif.")
table(["Zone", "Contenu", "Comportement"], [
    ["Barre latérale", "Projet actif navigation paramètres et profil local", "Le clic remplace le module central sans changer de projet."],
    ["En-tête", "Recherche notifications futures et création de projet", "La recherche filtre les éléments du module courant."],
    ["Zone centrale", "Tableaux formulaires calendrier Gantt ou tableau Scrum", "Le contenu dépend du projet et du module sélectionnés."],
    ["Fenêtre modale", "Création ou configuration d un objet", "Enregistrer ferme la fenêtre et recharge les données locales."],
], [1.25, 2.5, 2.8])
doc.add_heading("4.2 Navigation principale", level=2)
table(["Entrée", "Finalité", "Résultat attendu"], [
    ["Vue d ensemble", "Décider rapidement", "Indicateurs santé alertes et échéances."],
    ["Charte du projet", "Autoriser et cadrer", "Objectifs responsabilités méthode et dates."],
    ["Planning", "Ordonner le travail", "Calendrier liste Gantt dépendances et baseline."],
    ["Agile et Sprints", "Exécuter par incréments", "Backlogs tableau Sprint Goal et mesures."],
    ["Équipe", "Organiser les capacités", "Rôles disponibilité et compétences."],
    ["Fournisseurs et Achats", "Sourcer contractualiser et contrôler", "Registres consultations offres contrats documents et performance."],
    ["Risques", "Anticiper les menaces", "Score réponse responsable et lien planning."],
    ["Réunions", "Tracer les échanges", "Ordre du jour décisions actions et contexte."],
    ["Paramètres", "Administrer le poste", "Version et emplacement de la base locale."],
], [1.45, 2.0, 3.1])

page_break()
doc.add_heading("5 Modèle de données et liaisons", level=1)
doc.add_heading("5.1 Objets métier", level=2)
table(["Objet", "Identité et champs clés", "Relations principales"], [
    ["Projet", "Nom code méthode dates budget santé objectifs", "Contient tous les autres objets."],
    ["Activité", "WBS titre dates statut responsable charge progression", "Prédécesseur risque réunion et élément Scrum."],
    ["Risque", "Titre catégorie probabilité impact réponse statut", "Projet activité et propriétaire."],
    ["Membre", "Nom rôle courriel disponibilité compétences", "Projet activités et éléments Scrum assignés."],
    ["Réunion", "Objet date participants ordre du jour décisions actions", "Projet et activité concernée."],
    ["Sprint", "Nom objectif dates statut capacité notes", "Projet et éléments du Sprint Backlog."],
    ["Élément de backlog", "Type titre valeur critères points statut priorité", "Projet sprint membre epic et activité WBS."],
    ["Fournisseur", "Identité catégorie qualification risque conditions et contacts", "Projet consultations offres contrats documents évaluations."],
    ["Consultation", "Référence type périmètre budget délai critères et pondérations", "Projet activité WBS risque offres et documents."],
    ["Offre", "Fournisseur prix délai scores décision et validité", "Consultation fournisseur et attribution."],
    ["Contrat", "Numéro période montant livrables paiement statut et préavis", "Fournisseur consultation activité WBS documents évaluations."],
], [1.35, 2.8, 2.4])
doc.add_heading("5.2 Carte des liaisons", level=2)
flow = doc.add_paragraph()
flow.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = flow.add_run("PROJET  →  ACTIVITÉ WBS  →  RISQUE  →  RÉPONSE")
run.bold = True
run.font.color.rgb = RGBColor.from_string(INDIGO)
flow2 = doc.add_paragraph()
flow2.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = flow2.add_run("SPRINT  →  USER STORY  →  ACTIVITÉ WBS  →  JALON")
run.bold = True
run.font.color.rgb = RGBColor.from_string(TEAL)
flow3 = doc.add_paragraph()
flow3.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = flow3.add_run("RÉUNION  →  DÉCISION OU ACTION  →  ACTIVITÉ CONCERNÉE")
run.bold = True
run.font.color.rgb = RGBColor.from_string(NAVY)
flow4 = doc.add_paragraph()
flow4.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = flow4.add_run("BESOIN WBS  →  CONSULTATION  →  OFFRES  →  CONTRAT  →  ÉVALUATION")
run.bold = True
run.font.color.rgb = RGBColor.from_string("C96F28")
doc.add_heading("5.3 Effets des liaisons", level=2)
table(["Événement", "Conséquence visible"], [
    ["Une activité reçoit un prédécesseur", "Le Gantt projette sa position suivant le type de dépendance et le décalage."],
    ["Une activité est liée à une Story", "Le tableau Scrum affiche son code WBS et le pilotage peut rapprocher exécution et jalon."],
    ["Un risque est lié à une activité", "Le registre indique immédiatement le travail menacé."],
    ["Une réunion est liée à une activité", "Le compte rendu conserve son contexte opérationnel."],
    ["Un membre reçoit plusieurs charges simultanées", "Le Gantt signale une surcharge selon sa disponibilité."],
    ["Une baseline est enregistrée", "Le Gantt affiche une référence fine sous les barres actuelles."],
    ["Une consultation est liée à une activité", "Le dossier d achat conserve le besoin opérationnel et son impact calendrier."],
    ["Un contrat ou document approche de sa date limite", "Le tableau de bord Achats affiche une alerte d échéance."],
], [2.25, 4.3])

page_break()
doc.add_heading("6 Guide de démarrage", level=1)
doc.add_heading("6.1 Installation sur macOS et Windows", level=2)
for text in [
    "Ouvrir le fichier Jalonis 0.2.0 arm64.dmg.",
    "Faire glisser Jalonis vers le dossier Applications.",
    "Si macOS bloque le premier lancement, effectuer un clic droit sur Jalonis puis choisir Ouvrir.",
    "Au premier démarrage, vérifier dans Paramètres que le dossier de données est affiché.",
]: numbered(text)
p("Sur Windows 10 ou 11 en 64 bits, ouvrir Jalonis-0.2.0-Windows-x64-Setup.exe, choisir le dossier d installation puis terminer le programme d installation. Si Microsoft Defender SmartScreen affiche un avertissement pour cette version non signée, vérifier que le fichier provient bien du propriétaire du projet avant de choisir Informations complémentaires puis Exécuter quand même.")
p("La version macOS cible les Mac Apple Silicon. La version Windows cible les PC x64. Pour une diffusion commerciale, il faudra signer les deux installateurs et notariser la version Apple.")
doc.add_heading("6.2 Créer le premier projet", level=2)
for text in [
    "Cliquer sur Nouveau projet dans l’en-tête.",
    "Renseigner le nom, le code, le chef de projet, les dates, le budget et la description.",
    "Choisir Prédictif, Scrum ou Hybride comme mode de pilotage.",
    "Enregistrer puis ouvrir la Charte du projet pour compléter le sponsor, l’objectif et les critères de succès.",
]: numbered(text)
doc.add_heading("6.3 Choisir la méthode", level=2)
table(["Mode", "À choisir lorsque", "Modules centraux"], [
    ["Prédictif", "Le périmètre et les séquences sont planifiables à l avance.", "Charte Planning Gantt Risques."],
    ["Scrum", "Le produit évolue par incréments et apprentissage fréquent.", "Agile et Sprints Équipe Réunions."],
    ["Hybride", "La gouvernance exige des jalons mais la réalisation fonctionne par sprints.", "Tous les modules avec liaison Story vers WBS."],
], [1.2, 3.25, 2.1])

doc.add_heading("7 Gestion prédictive et planning", level=1)
doc.add_heading("7.1 Créer une activité", level=2)
p("Dans Planning, cliquer sur Ajouter. Le formulaire permet de renseigner le code WBS, le statut, la priorité, le responsable, le travail estimé, les dates, le prédécesseur, la dépendance, le décalage, l’avancement, le caractère jalon et les dates réelles.")
table(["Champ", "Règle d utilisation"], [
    ["Code WBS", "Identifie la position logique comme 1 1.1 ou 2.3.1."],
    ["Début et fin prévus", "Définissent la durée initiale affichée au calendrier et au Gantt."],
    ["Prédécesseur", "Désigne l activité qui pilote la position de la nouvelle activité."],
    ["Type", "FS fin début SS début début FF fin fin SF début fin."],
    ["Décalage", "Une valeur positive ajoute une attente et une valeur négative crée une avance."],
    ["Jalon", "Crée un point de contrôle sans durée représenté par un losange."],
    ["Travail estimé", "Alimente la détection de surcharge du responsable."],
    ["Progression", "Met à jour les indicateurs et la partie réalisée de la barre Gantt."],
], [1.45, 5.1])
doc.add_heading("7.2 Utiliser les vues", level=2)
table(["Vue", "Usage recommandé"], [
    ["Calendrier", "Lire les activités comme dans un agenda. Une activité de plusieurs jours forme une bande colorée qui continue sur les semaines suivantes."],
    ["Gantt", "Analyser la séquence, les dépendances, les jalons, la chaîne critique, les baselines et les surcharges."],
    ["Liste", "Contrôler rapidement WBS statut priorité responsable échéance et avancement."],
], [1.25, 5.3])
doc.add_heading("7.3 Enregistrer une baseline", level=2)
for text in [
    "Finaliser les dates prévues avant le démarrage de l’exécution.",
    "Ouvrir la vue Gantt.",
    "Cliquer sur Définir la référence.",
    "Après modification du planning, comparer chaque barre actuelle au trait fin de référence.",
]: numbered(text)

page_break()
doc.add_heading("8 Gestion Scrum", level=1)
doc.add_heading("8.1 Configurer la gouvernance Scrum", level=2)
p("Ouvrir Agile et Sprints puis Configurer. Le Product Goal exprime la cible durable du produit. La Definition of Done décrit les conditions de qualité communes qui rendent un incrément utilisable.")
doc.add_heading("8.2 Gérer le Product Backlog", level=2)
for text in [
    "Cliquer sur Élément de backlog.",
    "Choisir Epic, User Story, Bug ou Tâche.",
    "Renseigner le titre, la priorité, les Story Points et les critères d’acceptation.",
    "Choisir un responsable et, en mode hybride, l’activité WBS concernée.",
    "Laisser l’élément dans le Product Backlog ou l’affecter directement à un sprint.",
]: numbered(text)
doc.add_heading("8.3 Planifier et conduire un sprint", level=2)
for text in [
    "Créer un sprint avec un nom, un Sprint Goal, des dates et une capacité en points.",
    "Affecter au sprint les éléments qui contribuent au Sprint Goal.",
    "Vérifier que la somme des Story Points reste cohérente avec la capacité.",
    "Déplacer les cartes entre À faire, En cours, En revue et Terminé.",
    "Ne considérer un élément terminé que lorsqu’il satisfait la Definition of Done.",
    "Clôturer le sprint après la revue et enregistrer les conclusions de rétrospective dans une version future dédiée.",
]: numbered(text)
doc.add_heading("8.4 Lire les indicateurs", level=2)
table(["Indicateur", "Interprétation"], [
    ["Progression du sprint", "Rapport entre points terminés et points engagés."],
    ["Burndown", "Comparaison entre le travail restant et la trajectoire idéale."],
    ["Vélocité", "Nombre de points terminés dans chaque sprint clôturé."],
    ["Qualité", "Nombre d éléments terminés réputés conformes à la Definition of Done."],
], [1.5, 5.05])

doc.add_heading("9 Pilotage hybride", level=1)
doc.add_heading("9.1 Répartition des responsabilités", level=2)
table(["Niveau", "Objet", "Responsable principal", "Question traitée"], [
    ["Gouvernance", "Charte jalons baseline risques budget", "Chef de projet et sponsor", "Sommes-nous alignés sur les engagements"],
    ["Produit", "Product Goal valeur ordre du backlog", "Product Owner", "Quel résultat apporte le plus de valeur"],
    ["Sprint", "Sprint Goal Sprint Backlog plan quotidien", "Scrum Team", "Comment produire le prochain incrément"],
    ["Coordination", "Lien Story vers activité WBS", "Chef de projet et Product Owner", "Comment l incrément contribue au jalon"],
], [1.05, 1.85, 1.65, 2.0])
doc.add_heading("9.2 Parcours hybride recommandé", level=2)
for text in [
    "Créer la charte et les jalons contractuels ou de gouvernance.",
    "Construire une WBS au niveau des livrables et grandes activités, sans détailler toutes les tâches Scrum.",
    "Définir le Product Goal et le Product Backlog.",
    "Lier chaque User Story pertinente à l’activité WBS ou au jalon auquel elle contribue.",
    "Piloter l’équipe dans les sprints et remonter la tendance dans le tableau de bord et le Gantt.",
    "Lier les risques et réunions aux activités afin de conserver le contexte des écarts et décisions.",
]: numbered(text)
doc.add_heading("9.3 Règle anti double saisie", level=2)
p("La WBS décrit les engagements et livrables de pilotage. Le Product Backlog décrit la valeur et le travail émergent. Une User Story ne doit pas être recopiée comme activité détaillée dans le Gantt ; elle doit être liée à l’activité WBS qui porte son résultat.")

page_break()
doc.add_heading("10 Fournisseurs et achats", level=1)
doc.add_heading("10.1 Qualifier un fournisseur", level=2)
p("Ouvrir Fournisseurs et Achats puis Fournisseurs. Enregistrer la raison sociale, la catégorie, le type de prestation, les identifiants administratifs, les contacts, les conditions de paiement, le niveau de risque et un score de qualification sur 100. Le statut évolue de Prospect vers Qualifié ou Actif après vérification.")
doc.add_heading("10.2 Préparer une consultation", level=2)
for text in [
    "Choisir RFI pour collecter des informations, RFQ pour comparer des prix sur un besoin défini, RFP pour évaluer une solution, ou Appel d offres pour une procédure formalisée.",
    "Décrire le périmètre, le budget estimé, le calendrier, les critères et la méthode d évaluation.",
    "Lier la consultation à l activité WBS qui porte le besoin et, si nécessaire, au risque traité.",
    "Fixer la pondération technique et financière puis publier la consultation.",
]: numbered(text)
doc.add_heading("10.3 Comparer les offres et attribuer", level=2)
p("Chaque offre conserve son fournisseur, son prix, son délai, sa validité et ses notes technique, financière et de conformité. Jalonis calcule un score pondéré à partir des poids de la consultation. Le responsable documente la décision puis passe l offre retenue au statut Attribuée.")
doc.add_heading("10.4 Gérer les contrats et documents", level=2)
p("Le contrat reprend le fournisseur, la consultation source, la période, le montant, les conditions de paiement, les livrables, le responsable et le préavis d alerte. Le dossier documentaire accepte notamment les attestations fiscales, assurances, accords de confidentialité, offres, contrats, avenants, bons de commande, bons de livraison et factures.")
p("Lorsqu un fichier est joint, Jalonis en crée une copie dans son dossier local protégé. L original reste inchangé. La date d expiration alimente les alertes du tableau de bord Achats.")
doc.add_heading("10.5 Évaluer la performance", level=2)
p("Après une livraison, un jalon ou à la clôture du contrat, noter sur 100 la qualité, le respect des délais, la maîtrise des coûts, la conformité et la communication. La moyenne forme le score global et éclaire les futures consultations.")
page_break()
doc.add_heading("10.6 Documents du cycle fournisseur", level=2)
p("Le registre documentaire rassemble les preuves nécessaires à la sélection, à l engagement, au contrôle de conformité et au paiement.")
table(["Document", "Moment", "Contrôle principal"], [
    ["RFI", "Sourcing", "Capacités références et compréhension du marché."],
    ["RFQ et devis", "Besoin défini", "Prix délai validité et conformité commerciale."],
    ["RFP et proposition", "Solution à concevoir", "Approche technique équipe méthode coût et risques."],
    ["Contrat et avenant", "Attribution et changement", "Obligations livrables prix échéances responsabilité."],
    ["Bon de commande", "Engagement", "Référence quantité prix autorisation et rattachement contractuel."],
    ["Livraison et facture", "Exécution", "Service fait conformité montant et conditions de paiement."],
], [1.45, 1.45, 3.65])

page_break()
doc.add_heading("11 Risques équipe et réunions", level=1)
doc.add_heading("11.1 Registre des risques", level=2)
p("Chaque risque reçoit une probabilité et un impact de 1 à 5. Le score est leur produit. Un score de 15 ou plus est présenté comme critique dans l’interface. Le propriétaire suit la réponse et le statut.")
table(["Score", "Lecture", "Action recommandée"], [
    ["1 à 5", "Faible", "Surveiller et accepter si justifié."],
    ["6 à 14", "Modéré", "Définir une réponse et une date de revue."],
    ["15 à 25", "Élevé", "Traiter rapidement et informer la gouvernance."],
], [1.0, 1.7, 3.85])
doc.add_heading("11.2 Gestion de l équipe", level=2)
p("Le module Équipe conserve le rôle, les compétences et la disponibilité en pourcentage. Le Gantt rapproche cette disponibilité du travail estimé sur les activités simultanées. Une alerte de surcharge invite à réaffecter, décaler, réduire le contenu ou augmenter la capacité.")
doc.add_heading("11.3 Réunions et décisions", level=2)
p("Créer une réunion avec son objet, sa date, ses participants, son ordre du jour, ses décisions et ses actions. Lier la réunion à une activité lorsque le contenu concerne directement un livrable, une échéance ou un incident technique.")
doc.add_heading("11.4 Bonnes pratiques de traçabilité", level=2)
for text in [
    "Nommer un propriétaire unique pour chaque risque ou action.",
    "Rédiger une décision sous forme de résultat clair et daté.",
    "Relier la réunion ou le risque à l’activité avant de clôturer la saisie.",
    "Mettre à jour les dates réelles et l’avancement au même rythme que les revues de projet.",
]: bullet(text)

page_break()
doc.add_heading("12 Règles métier", level=1)
table(["Identifiant", "Règle"], [
    ["RM 01", "Chaque objet appartient à un projet et est supprimé avec celui-ci."],
    ["RM 02", "Une activité reçoit automatiquement une couleur persistante à sa création."],
    ["RM 03", "Le score d un risque est égal à probabilité multipliée par impact."],
    ["RM 04", "Une activité terminée contribue à l avancement moyen du projet."],
    ["RM 05", "Une dépendance FS place le successeur après la fin du prédécesseur et le décalage."],
    ["RM 06", "Une baseline conserve les dates prévues au moment de son enregistrement."],
    ["RM 07", "Un jalon est une activité sans durée représentée par un losange."],
    ["RM 08", "Un élément sans sprint appartient au Product Backlog."],
    ["RM 09", "Un élément affecté à un sprint entre dans le Sprint Backlog avec le statut À faire."],
    ["RM 10", "La progression Scrum est calculée avec les Story Points terminés."],
    ["RM 11", "Une ressource est signalée si la charge quotidienne estimée dépasse sa capacité."],
    ["RM 12", "Le mode hybride autorise la liaison d un élément Scrum à une activité WBS."],
    ["RM 13", "Le score d une offre applique les pondérations technique et financière de sa consultation."],
    ["RM 14", "Le score global fournisseur est la moyenne des cinq dimensions de performance."],
    ["RM 15", "Une pièce jointe est copiée dans le dossier local de Jalonis sans modifier l original."],
    ["RM 16", "Les contrats et documents arrivant à échéance sont signalés selon leur préavis."],
], [1.0, 5.55])

doc.add_heading("13 Exigences non fonctionnelles", level=1)
table(["Domaine", "Exigence", "Critère cible"], [
    ["Performance", "Ouverture fluide sur un ordinateur récent", "Écran courant affiché en moins de 2 secondes hors volumétrie extrême."],
    ["Disponibilité", "Utilisation sans connexion Internet", "Toutes les fonctions cœur restent disponibles hors ligne."],
    ["Intégrité", "Transactions fiables et relations cohérentes", "Contraintes de clés étrangères et journal SQLite WAL actifs."],
    ["Sécurité", "Isolation entre interface et système", "Context isolation active et accès disque limité au processus principal."],
    ["Ergonomie", "Navigation compréhensible sans formation lourde", "Un utilisateur crée un projet et une activité en moins de cinq minutes."],
    ["Compatibilité", "Apple Silicon et Windows x64", "DMG arm64 et installateur NSIS x64 générés."],
    ["Maintenabilité", "Séparation interface données et couche desktop", "Arborescence React Electron SQLite documentée."],
    ["Évolutivité", "Ajout de nouveaux registres sans réécriture", "Migrations incrémentales et API IPC par entité."],
], [1.1, 2.6, 2.85])
doc.add_heading("13.1 Exigences de sécurité futures", level=2)
for text in [
    "Chiffrement des sauvegardes et option de chiffrement de la base.",
    "Signature du code et notarisation Apple.",
    "Journal d’audit des modifications sensibles.",
    "Gestion des droits si une collaboration multiutilisateur est ajoutée.",
    "Validation stricte des données importées et protection contre les fichiers malveillants.",
]: bullet(text)

doc.add_heading("14 Architecture technique et données locales", level=1)
table(["Couche", "Technologie", "Responsabilité"], [
    ["Interface", "React et Vite", "Écrans formulaires tableaux calendrier Gantt Scrum et achats."],
    ["Application desktop", "Electron", "Fenêtres macOS et Windows cycle de vie et distribution installable."],
    ["Pont sécurisé", "Preload IPC", "Expose uniquement les opérations autorisées à l interface."],
    ["Domaine et stockage", "Node SQLite", "Schéma migrations requêtes et persistance locale."],
    ["Packaging", "electron builder", "Création du DMG macOS arm64 et de l installateur Windows x64."],
], [1.35, 1.55, 3.65])
doc.add_heading("14.1 Emplacement des données", level=2)
p("Sur macOS, la base est créée dans Application Support sous le répertoire jalonis. Sur Windows, elle est créée dans le dossier de données applicatives de l utilisateur. Son nom est jalonis.sqlite. Les pièces jointes fournisseur sont copiées dans le sous-dossier supplier-documents, organisé par projet et fournisseur.")
page_break()
doc.add_heading("14.2 Organisation du code", level=2)
table(["Dossier", "Contenu"], [
    ["electron", "Processus principal sécurité IPC migrations et accès SQLite."],
    ["src", "Interface React et orchestration des modules."],
    ["src components", "Composants Gantt Scrum achats formulaires et fenêtres modales."],
    ["public assets", "Logo et ressources visuelles."],
    ["docs", "Cahier des charges guide et vision produit."],
    ["release", "Installateurs DMG ZIP EXE et applications générées."],
], [1.55, 5.0])

doc.add_heading("15 Installation sauvegarde et maintenance", level=1)
doc.add_heading("15.1 Sauvegarde manuelle actuelle", level=2)
for text in [
    "Fermer Jalonis afin que toutes les écritures soient terminées.",
    "Ouvrir le dossier indiqué dans Paramètres.",
    "Copier jalonis.sqlite et le dossier supplier-documents dans un emplacement sûr et daté.",
    "Conserver plusieurs générations de sauvegarde.",
]: numbered(text)
p("Ne pas copier uniquement les fichiers WAL ou SHM. Une future fonction de sauvegarde intégrée automatisera la cohérence et le chiffrement.")
doc.add_heading("15.2 Mise à jour", level=2)
p("Installer la nouvelle version de l’application sans supprimer le dossier de données. Au lancement, Jalonis ajoute automatiquement les nouvelles colonnes ou tables nécessaires. Une sauvegarde préalable reste recommandée avant toute mise à jour importante.")
doc.add_heading("15.3 Dépannage", level=2)
table(["Symptôme", "Vérification", "Action"], [
    ["macOS refuse l ouverture", "Application non signée", "Clic droit puis Ouvrir pour la version de test."],
    ["Windows affiche SmartScreen", "Installateur non signé", "Vérifier la source puis utiliser Informations complémentaires pour le test."],
    ["Projet absent", "Projet actif ou portefeuille", "Ouvrir Tous les projets et sélectionner le bon projet."],
    ["Activité absente du calendrier", "Dates de début et fin", "Compléter les deux dates dans l activité."],
    ["Story absente du tableau", "Sprint affecté", "Affecter l élément au sprint affiché depuis le Product Backlog."],
    ["Gantt incohérent", "Prédécesseur type et décalage", "Corriger la relation et éviter les cycles de dépendances."],
    ["Surcharge inattendue", "Travail heures dates disponibilité", "Ajuster la charge ou la capacité du membre."],
    ["Document fournisseur introuvable", "Fichier du coffre local", "Restaurer le dossier supplier-documents avec la base correspondante."],
], [1.55, 2.0, 3.0])

doc.add_heading("16 Recette et critères d acceptation", level=1)
table(["Scénario", "Résultat attendu"], [
    ["Créer deux projets", "Ils apparaissent séparément dans le portefeuille et conservent leurs données propres."],
    ["Créer une activité sur plusieurs jours", "Une bande colorée continue apparaît dans le calendrier."],
    ["Lier deux activités en FS", "Le Gantt place le successeur après le prédécesseur."],
    ["Définir un jalon", "Le Gantt affiche un losange sans durée."],
    ["Enregistrer une baseline", "Le trait de référence reste visible après modification des dates."],
    ["Surcharger un membre", "Une alerte apparaît dans les informations du Gantt."],
    ["Créer un risque critique", "Le score est calculé et l alerte est visible au tableau de bord."],
    ["Créer un sprint et une Story", "La Story apparaît dans le Sprint Backlog et sur le tableau."],
    ["Déplacer la Story vers Terminé", "Les points terminés et le burndown sont mis à jour."],
    ["Lier la Story à une activité", "Le code WBS est visible sur la carte et dans le backlog."],
    ["Créer une RFQ liée au WBS", "La consultation affiche l activité et le risque éventuellement associés."],
    ["Saisir plusieurs offres", "La matrice classe les offres selon leur score pondéré."],
    ["Joindre une attestation", "Le fichier est copié localement et peut être ouvert depuis Jalonis."],
    ["Approcher une échéance", "Le contrat ou document apparaît dans les alertes Achats."],
    ["Évaluer un fournisseur", "La moyenne des cinq notes alimente son score de performance."],
    ["Relancer l application", "Les données créées sont retrouvées dans la base locale."],
], [2.3, 4.25])

page_break()
doc.add_heading("17 Feuille de route", level=1)
table(["Priorité", "Évolution", "Valeur"], [
    ["P1", "Modification complète des objets et confirmations de suppression", "Rendre le MVP exploitable au quotidien."],
    ["P1", "Sauvegarde restauration et export PDF Excel", "Sécuriser les données et faciliter le reporting."],
    ["P1", "Multiples prédécesseurs calendriers ouvrés et chemin critique complet", "Atteindre un niveau professionnel de planification."],
    ["P1", "Historique quotidien du burndown et notes de revue rétrospective", "Fiabiliser la mesure Scrum."],
    ["P2", "Coûts réels EVM CPI SPI EAC et tendances", "Renforcer le pilotage financier PMP."],
    ["P2", "Bons de commande réceptions factures paiements et écarts", "Compléter le cycle procure to pay."],
    ["P2", "RACI parties prenantes changements problèmes et décisions", "Compléter la gouvernance intégrée."],
    ["P2", "Glisser déposer du backlog et limites de travail en cours", "Fluidifier les pratiques agiles."],
    ["P3", "Collaboration chiffrée facultative et rôles", "Permettre le travail d équipe sans abandonner le local first."],
    ["P3", "Signature notarisation licences et mises à jour", "Préparer la commercialisation."],
], [0.75, 3.25, 2.55])

page_break()
doc.add_heading("18 Glossaire", level=1)
table(["Terme", "Définition"], [
    ["Baseline", "Photographie des dates prévues utilisée comme référence de comparaison."],
    ["Burndown", "Graphique du travail restant pendant un sprint."],
    ["Chemin critique", "Chaîne d’activités dont la durée pilote la date de fin du projet."],
    ["Definition of Done", "Description commune de l’état de qualité exigé pour un incrément."],
    ["Dépendance FS", "Relation où le successeur commence après la fin du prédécesseur."],
    ["Epic", "Regroupement fonctionnel important pouvant contenir plusieurs éléments de backlog."],
    ["Gantt", "Représentation temporelle des activités, durées, jalons et dépendances."],
    ["Jalon", "Point de contrôle important sans durée."],
    ["Product Backlog", "Liste ordonnée et évolutive de ce qui est nécessaire pour améliorer le produit."],
    ["Product Goal", "État futur du produit servant de cible au Scrum Team."],
    ["RFI", "Demande d information utilisée pour comprendre le marché et les capacités des fournisseurs."],
    ["RFQ", "Demande de cotation utilisée pour comparer des offres financières sur un besoin défini."],
    ["RFP", "Demande de proposition qui évalue une solution technique et commerciale."],
    ["Sprint", "Période de travail courte orientée vers un Sprint Goal."],
    ["Sprint Backlog", "Sprint Goal, éléments sélectionnés et plan de livraison de l’incrément."],
    ["Story Point", "Unité relative d’estimation de l’effort ou de la complexité."],
    ["WBS", "Décomposition hiérarchique du travail ou des livrables du projet."],
], [1.6, 4.95])
doc.add_heading("Références de conception", level=2)
p("Scrum Guide officiel, version de novembre 2020, scrumguides.org. Documentation Microsoft Support relative aux dépendances, aux baselines, au chemin critique et à la charge des ressources dans Microsoft Project. Commission européenne, Practical Guide PRAG et portail Tenders, pour le cycle consultation évaluation attribution contractualisation suivi et clôture.")
doc.add_heading("Fin du document", level=2)
p("Ce document couvre Jalonis 0.2.0. Il doit être mis à jour à chaque évolution structurante du modèle de données, des interfaces ou des règles métier.")

# Core properties and accessibility
doc.core_properties.title = "Cahier des charges et guide d utilisation de Jalonis"
doc.core_properties.subject = "Spécification fonctionnelle technique et manuel utilisateur de Jalonis 0.2.0"
doc.core_properties.author = "Jalonis"
doc.core_properties.last_modified_by = "Jalonis"
doc.core_properties.comments = ""
doc.core_properties.created = datetime(2026, 9, 27, tzinfo=timezone.utc)
doc.core_properties.modified = datetime(2026, 9, 27, tzinfo=timezone.utc)
doc.core_properties.keywords = "gestion de projet PMP Scrum hybride Gantt WBS macOS Windows"

for tbl in doc.tables:
    tbl.rows[0]._tr.get_or_add_trPr()

doc.save(OUTPUT)
print(OUTPUT)
