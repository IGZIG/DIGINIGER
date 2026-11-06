import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  extensionOf,
  formatBytes,
  looksLikeType,
  mimeFromExtension,
  preflightError,
  safeFileName,
} from "./course-files";

/**
 * Tests des règles d'acceptation des documents.
 * Ces règles protègent l'import : un fichier refusé ici ne part jamais vers
 * le stockage, et le serveur refait exactement les mêmes contrôles.
 */

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new Uint8Array([...text].map((c) => c.charCodeAt(0)));

describe("extensionOf / mimeFromExtension", () => {
  it("extrait l'extension en minuscules", () => {
    expect(extensionOf("Support.PDF")).toBe(".pdf");
    expect(extensionOf("cours.docx")).toBe(".docx");
  });

  it("renvoie une chaîne vide sans extension", () => {
    expect(extensionOf("README")).toBe("");
  });

  it("associe l'extension au bon type MIME", () => {
    expect(mimeFromExtension("a.pdf")).toBe("application/pdf");
    expect(mimeFromExtension("a.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(mimeFromExtension("a.pptx")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(mimeFromExtension("a.png")).toBe("image/png");
  });

  it("refuse une extension inconnue", () => {
    expect(mimeFromExtension("virus.exe")).toBeNull();
    expect(mimeFromExtension("script.sh")).toBeNull();
    expect(mimeFromExtension("archive.zip")).toBeNull();
  });
});

describe("preflightError — refus expliqués avant l'envoi", () => {
  it("accepte un PDF de taille raisonnable", () => {
    expect(preflightError({ name: "cours.pdf", size: 1024 })).toBeNull();
  });

  it("refuse un exécutable, même renommé", () => {
    const message = preflightError({ name: "cours.exe", size: 1024 });
    expect(message).toContain("format non accepté");
  });

  it("refuse un fichier vide", () => {
    expect(preflightError({ name: "vide.pdf", size: 0 })).toContain("vide");
  });

  it("refuse au-delà de 25 Mo en indiquant la taille", () => {
    const message = preflightError({ name: "gros.pdf", size: MAX_FILE_BYTES + 1 });
    expect(message).toContain("25 Mo");
    expect(message).toContain("Mo");
  });

  it("accepte un fichier exactement à la limite", () => {
    expect(preflightError({ name: "limite.pdf", size: MAX_FILE_BYTES })).toBeNull();
  });
});

describe("looksLikeType — contrôle du contenu réel", () => {
  it("reconnaît un vrai PDF", () => {
    expect(looksLikeType(ascii("%PDF-1.7\n"), "application/pdf")).toBe(true);
  });

  it("refuse un exécutable Windows déguisé en PDF", () => {
    // Un fichier commençant par MZ est un exécutable, quel que soit son nom.
    expect(looksLikeType(ascii("MZ\x90\x00"), "application/pdf")).toBe(false);
    expect(looksLikeType(ascii("MZ\x90\x00"), "image/png")).toBe(false);
  });

  it("refuse un fichier texte renommé en PDF", () => {
    expect(looksLikeType(ascii("bonjour"), "application/pdf")).toBe(false);
  });

  it("reconnaît une archive ZIP (docx, pptx, xlsx, odt)", () => {
    const zip = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);
    expect(
      looksLikeType(
        zip,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
    expect(
      looksLikeType(
        zip,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).toBe(true);
  });

  it("reconnaît un ancien document Word (conteneur OLE)", () => {
    const ole = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1);
    expect(looksLikeType(ole, "application/msword")).toBe(true);
  });

  it("reconnaît les images", () => {
    expect(looksLikeType(bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg")).toBe(true);
    expect(looksLikeType(bytes(0x89, 0x50, 0x4e, 0x47), "image/png")).toBe(true);
    expect(looksLikeType(ascii("RIFF0000WEBP"), "image/webp")).toBe(true);
  });

  it("refuse un binaire présenté comme du texte (octet nul)", () => {
    expect(looksLikeType(bytes(0x68, 0x00, 0x69), "text/plain")).toBe(false);
    expect(looksLikeType(ascii("une note de cours"), "text/plain")).toBe(true);
  });

  it("refuse un en-tête vide", () => {
    expect(looksLikeType(new Uint8Array(), "application/pdf")).toBe(false);
  });
});

describe("safeFileName — nom stocké propre", () => {
  it("remplace accents et espaces", () => {
    expect(safeFileName("Résumé du cours n°1.pdf")).toBe("Resume-du-cours-n-1.pdf");
  });

  it("conserve l'extension d'origine", () => {
    expect(safeFileName("Mon Fichier.DOCX")).toBe("Mon-Fichier.docx");
  });

  it("ne produit jamais un nom vide", () => {
    expect(safeFileName("...pdf")).toMatch(/^document|^[a-z0-9-]+\.pdf$/);
  });
});

describe("formatBytes — affichage lisible", () => {
  it("affiche les octets puis les kilo-octets puis les méga-octets", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(2048)).toBe("2 Ko");
    expect(formatBytes(1_572_864)).toBe("1,5 Mo");
  });

  it("gère l'absence de valeur", () => {
    expect(formatBytes(0)).toBe("—");
  });
});
