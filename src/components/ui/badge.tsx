import { cn } from "@/lib/utils";

type Tone = "neutral" | "electric" | "gold" | "green" | "red" | "night";

const tones: Record<Tone, string> = {
  neutral: "bg-night-50 text-night-600 border-night-100",
  electric: "bg-electric-50 text-electric-700 border-electric-100",
  gold: "bg-gold-50 text-gold-700 border-gold-100",
  green: "bg-emerald-50 text-emerald-700 border-emerald-100",
  red: "bg-red-50 text-red-700 border-red-100",
  night: "bg-night-800 text-white border-night-800",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
