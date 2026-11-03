import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "gold" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-electric-500 text-white hover:bg-electric-600 shadow-glow disabled:bg-electric-300",
  secondary:
    "bg-night-800 text-white hover:bg-night-700 disabled:bg-night-400",
  ghost: "text-night-600 hover:bg-night-50 hover:text-night-800",
  outline:
    "border border-night-200 bg-white text-night-700 hover:border-night-300 hover:bg-night-50",
  gold: "bg-gold-500 text-night-900 hover:bg-gold-400 shadow-soft font-semibold",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-7 text-base gap-2.5 py-3.5",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.98]";

export const Button = forwardRef<
  HTMLButtonElement,
  BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: BaseProps & { href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
