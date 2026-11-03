import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "electric",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "electric" | "gold" | "green" | "night";
}) {
  const tones = {
    electric: "bg-electric-50 text-electric-600",
    gold: "bg-gold-50 text-gold-600",
    green: "bg-emerald-50 text-emerald-600",
    night: "bg-night-50 text-night-600",
  };

  return (
    <div className="rounded-2xl border border-night-100 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-night-400">{label}</p>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-bold text-night-800">{value}</p>
      {hint && <p className="mt-1 text-xs text-night-300">{hint}</p>}
    </div>
  );
}
