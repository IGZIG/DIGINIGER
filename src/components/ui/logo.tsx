import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marque DIGINIGER : monogramme D + point doré (IA). */
export function Logo({
  inverted = false,
  compact = false,
  className,
}: {
  inverted?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="DIGINIGER — accueil"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-night-800 shadow-soft transition-transform group-hover:scale-105">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
          <path
            d="M9 23V9h6.2c4.6 0 7.6 2.6 7.6 7s-3 7-7.6 7H9Z"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <circle cx="23.5" cy="8.5" r="2.6" fill="#F59E0B" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display text-lg font-bold tracking-tight",
              inverted ? "text-white" : "text-night-800",
            )}
          >
            DIGINIGER
          </span>
          <span
            className={cn(
              "mt-1 text-[10px] font-medium uppercase tracking-[0.18em]",
              inverted ? "text-white/50" : "text-night-300",
            )}
          >
            Académie numérique
          </span>
        </span>
      )}
    </Link>
  );
}
