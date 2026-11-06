import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import QRCode from "qrcode";

/**
 * Génération du certificat PDF (côté serveur uniquement).
 *
 * Chaque certificat porte l'identité de l'ÉCOLE qui délivre la formation :
 * son nom, son slogan, sa couleur et la signature de son directeur.
 * DIGINIGER n'apparaît plus qu'en petit, en tant que plateforme émettrice.
 *
 * Le PDF est déterministe : mêmes données → mêmes octets (hors horodatage).
 * Le QR code renvoie vers la page publique de vérification.
 */

const NIGHT = rgb(0.0627, 0.1059, 0.2392); // #101B3D
const GOLD = rgb(0.9608, 0.6196, 0.0431); // #F59E0B
const GREY = rgb(0.45, 0.49, 0.58);
const LIGHT = rgb(0.6, 0.63, 0.7);
const FALLBACK_ACCENT = "#2563EB"; // bleu électrique DIGINIGER

export interface SchoolIdentity {
  /** Nom de l'école, tel qu'affiché en en-tête. */
  name: string;
  /** Slogan de l'école. */
  tagline?: string | null;
  /** Couleur principale au format hexadécimal (#RRGGBB). */
  accent?: string | null;
  /** Nom du directeur (ou de la directrice) qui signe. */
  directorName?: string | null;
  /** « Directeur », « Directrice », « Directeur des études »… */
  directorRole?: string | null;
}

export interface CertificateData {
  serial: string;
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  score: number | null;
  verificationUrl: string;
  /** École émettrice. Facultatif : repli sur la signature DIGINIGER. */
  school?: SchoolIdentity | null;
  /** Affiche un filigrane « SPÉCIMEN » (maquettes, modèles à valider). */
  specimen?: boolean;
}

/** Convertit « #16A34A » en couleur pdf-lib, avec repli sûr. */
function hexToRgb(hex: string | null | undefined) {
  const clean = (hex ?? "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hexToRgb(FALLBACK_ACCENT);
  const value = parseInt(clean, 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

/** Identité complétée : plus aucun champ vide après cette étape. */
type ResolvedSchool = {
  name: string;
  tagline: string;
  accent: string;
  directorName: string;
  directorRole: string;
};

/** Signature d'école par défaut : DIGINIGER lui-même. */
function identityOf(school?: SchoolIdentity | null): ResolvedSchool {
  return {
    name: school?.name?.trim() || "DIGINIGER ACADÉMIE NUMÉRIQUE INTELLIGENTE",
    tagline: school?.tagline?.trim() || "Apprendre aujourd'hui. Construire le monde de demain.",
    accent: school?.accent?.trim() || FALLBACK_ACCENT,
    directorName: school?.directorName?.trim() || "La Direction académique",
    directorRole: school?.directorRole?.trim() || "Direction académique",
  };
}

/** « Le Directeur » / « La Directrice ». */
function civilityFor(role: string): string {
  return /trice|responsable/i.test(role) ? "La" : "Le";
}

export async function buildCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const school = identityOf(data.school);
  const accent = hexToRgb(school.accent);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificat ${data.serial} — ${school.name}`);
  pdf.setAuthor(school.name);
  pdf.setSubject(data.courseTitle);
  pdf.setKeywords(["certificat", "DIGINIGER", school.name, data.serial]);

  const page = pdf.addPage([842, 595]); // A4 paysage
  const { width, height } = page.getSize();

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const fontScript = await pdf.embedFont(StandardFonts.TimesRomanItalic); // signature

  const centered = (text: string, size: number, font: typeof fontRegular) =>
    (width - font.widthOfTextAtSize(text, size)) / 2;

  // --- Fond et bandeaux de couleur de l'école -----------------------------
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.995, 0.995, 0.998) });
  page.drawRectangle({ x: 0, y: 0, width: 12, height, color: accent }); // bande gauche
  page.drawRectangle({ x: 0, y: height - 10, width, height: 10, color: accent }); // bande haute
  page.drawRectangle({ x: 0, y: 0, width, height: 4, color: accent }); // bande basse

  // --- En-tête : école à gauche, plateforme à droite ----------------------
  const schoolSize = school.name.length > 30 ? 17 : 20;
  page.drawText(school.name.toUpperCase(), {
    x: 46,
    y: height - 62,
    size: schoolSize,
    font: fontBold,
    color: accent,
  });

  if (school.tagline) {
    page.drawText(school.tagline.slice(0, 90), {
      x: 46,
      y: height - 80,
      size: 8.5,
      font: fontItalic,
      color: GREY,
    });
  }

  page.drawText("DIGINIGER", {
    x: width - 46 - fontBold.widthOfTextAtSize("DIGINIGER", 13),
    y: height - 58,
    size: 13,
    font: fontBold,
    color: NIGHT,
  });
  page.drawText("Plateforme de formation certifiante", {
    x: width - 46 - fontRegular.widthOfTextAtSize("Plateforme de formation certifiante", 7.5),
    y: height - 72,
    size: 7.5,
    font: fontRegular,
    color: LIGHT,
  });
  page.drawText("République du Niger", {
    x: width - 46 - fontRegular.widthOfTextAtSize("République du Niger", 7.5),
    y: height - 84,
    size: 7.5,
    font: fontRegular,
    color: LIGHT,
  });

  // Filet de couleur sous l'en-tête
  page.drawRectangle({ x: 46, y: height - 104, width: width - 92, height: 2, color: accent });

  // --- Titre ---------------------------------------------------------------
  const title = "CERTIFICAT DE RÉUSSITE";
  page.drawText(title, {
    x: centered(title, 26, fontBold),
    y: height - 168,
    size: 26,
    font: fontBold,
    color: NIGHT,
  });
  page.drawText("Décerné à", {
    x: centered("Décerné à", 10, fontRegular),
    y: height - 196,
    size: 10,
    font: fontRegular,
    color: GREY,
  });

  // --- Nom de l'apprenant --------------------------------------------------
  const nameSize = data.studentName.length > 26 ? 24 : 30;
  page.drawText(data.studentName, {
    x: centered(data.studentName, nameSize, fontBold),
    y: height - 240,
    size: nameSize,
    font: fontBold,
    color: NIGHT,
  });
  page.drawRectangle({
    x: centered(data.studentName, nameSize, fontBold),
    y: height - 252,
    width: fontBold.widthOfTextAtSize(data.studentName, nameSize),
    height: 2.5,
    color: GOLD,
  });

  // --- Formation -----------------------------------------------------------
  const intro = "pour avoir suivi et validé avec succès la formation";
  page.drawText(intro, {
    x: centered(intro, 11, fontRegular),
    y: height - 286,
    size: 11,
    font: fontRegular,
    color: GREY,
  });

  const titleSize = data.courseTitle.length > 52 ? 15 : 18;
  const courseLines = wrapText(data.courseTitle, 560, titleSize, fontBold).slice(0, 2);
  courseLines.forEach((line, index) => {
    page.drawText(line, {
      x: centered(line, titleSize, fontBold),
      y: height - 320 - index * (titleSize + 8),
      size: titleSize,
      font: fontBold,
      color: accent,
    });
  });

  // --- Mention de réussite -------------------------------------------------
  const mention =
    data.score == null
      ? "Formation validée — cours, travaux pratiques et évaluations."
      : `Formation validée avec une moyenne de ${data.score}/100.`;
  page.drawText(mention, {
    x: centered(mention, 9.5, fontItalic),
    y: height - 366,
    size: 9.5,
    font: fontItalic,
    color: GREY,
  });

  // --- Bloc de gauche : références ----------------------------------------
  const issuedLabel = `Délivré le ${data.issuedAt.toLocaleDateString("fr-FR")}`;
  page.drawText(issuedLabel, { x: 46, y: 148, size: 10, font: fontRegular, color: GREY });
  page.drawText(`Numéro : ${data.serial}`, {
    x: 46,
    y: 130,
    size: 10,
    font: fontBold,
    color: NIGHT,
  });
  page.drawText("Vérifiez l'authenticité de ce certificat :", {
    x: 46,
    y: 108,
    size: 8.5,
    font: fontRegular,
    color: GREY,
  });
  const shortUrl = data.verificationUrl.replace(/^https?:\/\//, "").slice(0, 58);
  page.drawText(shortUrl, { x: 46, y: 94, size: 8.5, font: fontRegular, color: accent });

  // --- Bloc central : signature du directeur ------------------------------
  const signatureX = 300;
  page.drawText(`${civilityFor(school.directorRole)} ${school.directorRole}`, {
    x: signatureX,
    y: 148,
    size: 8.5,
    font: fontRegular,
    color: GREY,
  });

  // Nom en script + trait de plume
  const signSize = school.directorName.length > 22 ? 16 : 19;
  page.drawText(school.directorName, {
    x: signatureX,
    y: 112,
    size: signSize,
    font: fontScript,
    color: NIGHT,
  });
  const signWidth = fontScript.widthOfTextAtSize(school.directorName, signSize);
  page.drawSvgPath(
    "M0,0 C18,-13 34,10 52,-2 S84,-15 100,2 S126,9 142,-4",
    { x: signatureX, y: 100, scale: signWidth / 142, borderColor: accent, borderWidth: 1.4 },
  );
  page.drawRectangle({ x: signatureX, y: 92, width: 200, height: 0.8, color: LIGHT });
  page.drawText(school.name.slice(0, 46), {
    x: signatureX,
    y: 78,
    size: 8,
    font: fontBold,
    color: GREY,
  });

  // --- Bloc de droite : QR code -------------------------------------------
  const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    margin: 1,
    width: 320,
    color: { dark: "#101B3D", light: "#FFFFFF" },
  });
  const qrImage = await pdf.embedPng(qrDataUrl);
  const qrSize = 104;
  page.drawImage(qrImage, {
    x: width - 46 - qrSize,
    y: 78,
    width: qrSize,
    height: qrSize,
  });
  page.drawText("Scanner pour vérifier", {
    x: width - 46 - fontRegular.widthOfTextAtSize("Scanner pour vérifier", 8),
    y: 64,
    size: 8,
    font: fontRegular,
    color: GREY,
  });

  // --- Pied de page ---------------------------------------------------------
  const footer = `Document émis électroniquement par DIGINIGER — Académie numérique intelligente · ${school.name} · Niamey, Niger`;
  page.drawText(footer.slice(0, 150), {
    x: centered(footer.slice(0, 150), 7, fontRegular),
    y: 34,
    size: 7,
    font: fontRegular,
    color: LIGHT,
  });

  // --- Filigrane « SPÉCIMEN » ----------------------------------------------
  if (data.specimen) {
    const mark = "SPÉCIMEN";
    page.drawText(mark, {
      x: 150,
      y: 250,
      size: 82,
      font: fontBold,
      color: rgb(0.86, 0.87, 0.9),
      rotate: degrees(-28),
      opacity: 0.55,
    });
  }

  return pdf.save();
}

function wrapText(
  text: string,
  maxWidth: number,
  size: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
