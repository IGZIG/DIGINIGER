"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl border border-night-200 bg-white px-4 py-3 text-sm text-night-800 placeholder:text-night-300 transition-colors focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-100 disabled:bg-night-50 disabled:text-night-300";

export function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-night-600">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
      {children}
    </p>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(fieldBase, invalid && "border-red-300 focus:border-red-500 focus:ring-red-100", className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, "min-h-[120px] resize-y", invalid && "border-red-300", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, "pr-9", invalid && "border-red-300", className)} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({
  id,
  label,
  checked,
  onChange,
  error,
}: {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-night-300 text-electric-500 focus:ring-electric-200"
          aria-invalid={Boolean(error) || undefined}
        />
        <label htmlFor={id} className="text-sm leading-snug text-night-500">
          {label}
        </label>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Jauge de robustesse du mot de passe (4 niveaux). */
export function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["Très faible", "Faible", "Correct", "Bon", "Excellent"];
  const colors = ["bg-red-400", "bg-red-400", "bg-gold-400", "bg-emerald-400", "bg-emerald-500"];

  if (!password) return null;

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              index < score ? colors[score] : "bg-night-100",
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-night-400">{labels[score]}</p>
    </div>
  );
}
