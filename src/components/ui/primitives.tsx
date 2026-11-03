import { cn } from "@/lib/utils";
import { Loader2, Star } from "lucide-react";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-surface p-6", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">{title}</h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-night-400">{description}</p>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-electric-500", className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-night-200 bg-mist/60 px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-electric-500 shadow-soft">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-night-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star className="h-4 w-4 fill-gold-500 text-gold-500" aria-hidden />
      <span className="font-semibold text-night-700">{value.toFixed(1)}</span>
      {typeof count === "number" && (
        <span className="text-night-300">({count})</span>
      )}
    </span>
  );
}

export function Progress({
  value,
  className,
  tone = "electric",
  label,
}: {
  value: number;
  className?: string;
  tone?: "electric" | "gold" | "green";
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const tones = {
    electric: "bg-electric-500",
    gold: "bg-gold-500",
    green: "bg-emerald-500",
  };
  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-night-400">
          <span>{label}</span>
          <span className="font-semibold text-night-600">{clamped} %</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-night-100"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progression"}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", tones[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "error" | "warning";
  title?: string;
  children?: React.ReactNode;
}) {
  const tones = {
    info: "border-electric-100 bg-electric-50 text-electric-800",
    success: "border-emerald-100 bg-emerald-50 text-emerald-800",
    error: "border-red-100 bg-red-50 text-red-800",
    warning: "border-gold-100 bg-gold-50 text-gold-800",
  };
  return (
    <div role="status" className={cn("rounded-2xl border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-1", "leading-relaxed")}>{children}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const initials = (name || "DG")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-night-800 text-sm font-semibold text-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
