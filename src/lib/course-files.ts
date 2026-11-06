/**
 * Documents de formation — règles partagées entre le serveur et l'interface.
 *
 * Ce fichier ne contient volontairement aucun code serveur : il est importé
 * par les Server Actions (contrôle) ET par le formulaire (message immédiat).
 * La vérité reste le contrôle serveur ; l'interface ne fait qu'éviter un
 * aller-retour inutile à l'utilisateur.
 */

/** 25 Mo : au-delà, le dépôt est refusé (limite du compartiment). */
export const MAX_FILE_BYTES = 26_214_400;
export const MAX_FILES_PER_BATCH = 10;

/**
 * Types acceptés. On liste les extensions ET les types MIME : un navigateur
 * envoie parfois un type générique (`application/octet-stream`), mais
 * l'extension seule ne suffit pas (n'importe quel fichier peut être renommé).
 * Le serveur vérifie les deux et le contenu réel (nombre magique).
 */
export const ACCEPTED_TYPES: Array<{
  mime: string;
  extensions: string[];
  label: string;
  family: "pdf" | "word" | "presentation" | "sheet" | "text" | "image";
}> = [
  { mime: "application/pdf", extensions: [".pdf"], label: "PDF", family: "pdf" },
  {
    mime: "application/msword",
    extensions: [".doc"],
    label: "Word",
    family: "word",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: [".docx"],
    label: "Word",
    family: "word",
  },
  {
    mime: "application/vnd.ms-powerpoint",
    extensions: [".ppt"],
    label: "PowerPoint",
    family: "presentation",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: [".pptx"],
    label: "PowerPoint",
    family: "presentation",
  },
  {
    mime: "application/vnd.ms-excel",
    extensions: [".xls"],
    label: "Tableur",
    family: "sheet",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: [".xlsx"],
    label: "Tableur",
    family: "sheet",
  },
  {
    mime: "application/vnd.oasis.opendocument.text",
    extensions: [".odt"],
    label: "OpenDocument texte",
    family: "word",
  },
  {
    mime: "application/vnd.oasis.opendocument.presentation",
    extensions: [".odp"],
    label: "OpenDocument présentation",
    family: "presentation",
  },
  {
    mime: "application/vnd.oasis.opendocument.spreadsheet",
    extensions: [".ods"],
    label: "OpenDocument tableur",
    family: "sheet",
  },
  { mime: "text/plain", extensions: [".txt"], label: "Texte", family: "text" },
  { mime: "text/markdown", extensions: [".md"], label: "Markdown", family: "text" },
  { mime: "text/csv", extensions: [".csv"], label: "CSV", family: "text" },
  { mime: "image/jpeg", extensions: [".jpg", ".jpeg"], label: "Image", family: "image" },
  { mime: "image/png", extensions: [".png"], label: "Image", family: "image" },
  { mime: "image/webp", extensions: [".webp"], label: "Image", family: "image" },
];

export const ACCEPTED_EXTENSIONS = ACCEPTED_TYPES.flatMap((type) => type.extensions);

/** Attribut `accept` du champ fichier. */
export const ACCEPT_ATTRIBUTE = [...ACCEPTED_EXTENSIONS, ...ACCEPTED_TYPES.map((t) => t.mime)]
  .join(",");

export function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index).toLowerCase();
}

/** Type MIME déduit de l'extension (le navigateur n'est pas fiable). */
export function mimeFromExtension(fileName: string): string | null {
  const extension = extensionOf(fileName);
  const match = ACCEPTED_TYPES.find((type) => type.extensions.includes(extension));
  return match?.mime ?? null;
}

/** Libellé lisible d'une famille de fichier (icône / couleur dans l'interface). */
export function familyOf(mimeType: string): "pdf" | "word" | "presentation" | "sheet" | "text" | "image" | "other" {
  return ACCEPTED_TYPES.find((type) => type.mime === mimeType)?.family ?? "other";
}

/**
 * Refus expliqué en français, AVANT l'envoi.
 * Renvoie null si le fichier est acceptable en apparence.
 */
export function preflightError(file: { name: string; size: number }): string | null {
  const extension = extensionOf(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return `« ${file.name} » : format non accepté. Formats possibles : PDF, Word, PowerPoint, tableur, texte, image.`;
  }
  if (file.size === 0) {
    return `« ${file.name} » est vide : il n'y a rien à importer.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `« ${file.name} » dépasse 25 Mo (${(file.size / 1024 / 1024).toFixed(1)} Mo). Compressez-le ou découpez-le.`;
  }
  return null;
}

/** Nom de fichier nettoyé pour le stockage (sans accents ni caractères spéciaux). */
export function safeFileName(fileName: string): string {
  const extension = extensionOf(fileName);
  const base = fileName
    .slice(0, fileName.length - extension.length)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "document"}${extension}`;
}

/** Taille lisible : 1,2 Mo / 340 Ko. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

/**
 * Contrôle du contenu réel d'un fichier à partir de ses premiers octets.
 * Un exécutable renommé en `.pdf` commence par « MZ » : refusé partout.
 * Les formats bureautiques récents (docx, pptx, xlsx, odt…) sont des archives
 * ZIP et commencent par « PK ». Les anciens formats Office sont des conteneurs
 * OLE (D0 CF 11 E0).
 */
export function looksLikeType(header: Uint8Array, mime: string): boolean {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...Array.from(header.slice(from, to)));

  if (header.length === 0) return false;

  // Exécutable Windows (MZ) : jamais accepté, quel que soit le nom.
  if (ascii(0, 2) === "MZ") return false;

  const isZip = header[0] === 0x50 && header[1] === 0x4b; // PK
  const isOle =
    header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0;

  switch (mime) {
    case "application/pdf":
      return ascii(0, 5) === "%PDF-";
    case "application/msword":
    case "application/vnd.ms-powerpoint":
    case "application/vnd.ms-excel":
      return isOle;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.oasis.opendocument.text":
    case "application/vnd.oasis.opendocument.presentation":
    case "application/vnd.oasis.opendocument.spreadsheet":
      return isZip;
    case "image/jpeg":
      return header[0] === 0xff && header[1] === 0xd8;
    case "image/png":
      return header[0] === 0x89 && ascii(1, 4) === "PNG";
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "text/plain":
    case "text/markdown":
    case "text/csv":
      // Un fichier texte ne contient pas d'octet nul.
      return !header.includes(0);
    default:
      return false;
  }
}
