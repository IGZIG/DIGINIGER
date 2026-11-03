import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

/**
 * Génération du certificat PDF (côté serveur uniquement).
 * Le PDF est déterministe à partir des données enregistrées : le QR code
 * pointe vers la page publique de vérification, avec le numéro de série.
 */

const NIGHT = rgb(0.0627, 0.1059, 0.2392); // #101B3D
const ELECTRIC = rgb(0.1451, 0.3882, 0.9216); // #2563EB
const GOLD = rgb(0.9608, 0.6196, 0.0431); // #F59E0B
const GREY = rgb(0.45, 0.49, 0.58);

export interface CertificateData {
  serial: string;
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  score: number | null;
  verificationUrl: string;
}

export async function buildCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificat ${data.serial} — DIGINIGER`);
  pdf.setAuthor("DIGINIGER");
  pdf.setSubject(data.courseTitle);

  const page = pdf.addPage([842, 595]); // A4 paysage
  const { width, height } = page.getSize();

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Fond
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.984, 0.988, 0.996) });

  // Cadre
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: NIGHT,
    borderWidth: 2,
    color: rgb(1, 1, 1),
  });
  page.drawRectangle({ x: 28, y: height - 108, width: width - 56, height: 80, color: NIGHT });
  page.drawRectangle({ x: 28, y: 28, width: 8, height: height - 56, color: ELECTRIC });

  // En-tête
  page.drawText("DIGINIGER", {
    x: 60,
    y: height - 68,
    size: 26,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("ACADÉMIE NUMÉRIQUE INTELLIGENTE", {
    x: 60,
    y: height - 90,
    size: 9,
    font: fontRegular,
    color: rgb(0.65, 0.71, 0.85),
  });
  page.drawText("Apprendre aujourd'hui. Construire le monde de demain.", {
    x: width - 60 - fontItalic.widthOfTextAtSize("Apprendre aujourd'hui. Construire le monde de demain.", 9),
    y: height - 90,
    size: 9,
    font: fontItalic,
    color: GOLD,
  });

  // Titre
  page.drawText("CERTIFICAT DE RÉUSSITE", {
    x: 60,
    y: height - 165,
    size: 12,
    font: fontBold,
    color: ELECTRIC,
  });

  // Apprenant
  page.drawText("Décerné à", { x: 60, y: height - 205, size: 11, font: fontRegular, color: GREY });
  page.drawText(data.studentName, {
    x: 60,
    y: height - 248,
    size: 30,
    font: fontBold,
    color: NIGHT,
  });
  page.drawRectangle({ x: 60, y: height - 258, width: 340, height: 2, color: GOLD });

  // Formation
  page.drawText("pour avoir suivi et validé avec succès la formation", {
    x: 60,
    y: height - 288,
    size: 11,
    font: fontRegular,
    color: GREY,
  });

  const titleSize = data.courseTitle.length > 52 ? 15 : 19;
  wrapText(data.courseTitle, 460, titleSize, fontBold).forEach((line, index) => {
    page.drawText(line, {
      x: 60,
      y: height - 318 - index * (titleSize + 6),
      size: titleSize,
      font: fontBold,
      color: NIGHT,
    });
  });

  // Métadonnées
  page.drawText(`Date d'obtention : ${data.issuedAt.toLocaleDateString("fr-FR")}`, {
    x: 60,
    y: 150,
    size: 10,
    font: fontRegular,
    color: GREY,
  });
  if (data.score != null) {
    page.drawText(`Score moyen obtenu : ${data.score}/100`, {
      x: 60,
      y: 132,
      size: 10,
      font: fontRegular,
      color: GREY,
    });
  }
  page.drawText(`Numéro de certificat : ${data.serial}`, {
    x: 60,
    y: 114,
    size: 10,
    font: fontBold,
    color: NIGHT,
  });
  page.drawText("Vérifiez l'authenticité de ce certificat en ligne :", {
    x: 60,
    y: 90,
    size: 9,
    font: fontRegular,
    color: GREY,
  });
  page.drawText(data.verificationUrl, {
    x: 60,
    y: 76,
    size: 9,
    font: fontRegular,
    color: ELECTRIC,
  });

  // QR code
  const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    margin: 1,
    width: 320,
    color: { dark: "#101B3D", light: "#FFFFFF" },
  });
  const qrImage = await pdf.embedPng(qrDataUrl);
  page.drawImage(qrImage, { x: width - 230, y: 90, width: 150, height: 150 });
  page.drawText("Scanner pour vérifier", {
    x: width - 230,
    y: 74,
    size: 8,
    font: fontRegular,
    color: GREY,
  });
  page.drawText("Document émis électroniquement par DIGINIGER", {
    x: width - 230,
    y: 60,
    size: 7,
    font: fontItalic,
    color: GREY,
  });

  return pdf.save();
}

function wrapText(text: string, maxWidth: number, size: number, font: { widthOfTextAtSize: (t: string, s: number) => number }): string[] {
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
  return lines.slice(0, 3);
}
