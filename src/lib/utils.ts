import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusionne des classes Tailwind sans conflits. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formate un montant en FCFA (XOF), sans décimale. */
export function formatXof(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} FCFA`;
}

/** Formate un nombre à la française. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

/** Date lisible : 12 mars 2026. */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Durée en heures → « 24 h 30 ». */
export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export const LEVEL_LABELS: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  in_review: "En validation",
  published: "Publié",
  archived: "Archivé",
};

/** Initiales pour les avatars. */
export function initials(name: string | null | undefined): string {
  if (!name) return "DG";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
