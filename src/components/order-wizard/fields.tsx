import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FieldErrors = Record<string, string>;

export function Field({ label, error, hint, id, className, ...props }: ComponentProps<"input"> & { label: string; error?: string; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-medium">{label}</label>
      <Input {...props} id={id} className={cn("h-11", className)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />
      {hint && !error ? <p id={`${id}-hint`} className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="mt-2 text-xs leading-5 text-destructive">{error}</p> : null}
    </div>
  );
}

export function SelectField({ label, error, id, children, className, ...props }: ComponentProps<"select"> & { label: string; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-medium">{label}</label>
      <select {...props} id={id} className={cn("h-11 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 disabled:opacity-50", className)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
        {children}
      </select>
      {error ? <p id={`${id}-error`} className="mt-2 text-xs leading-5 text-destructive">{error}</p> : null}
    </div>
  );
}

export function RadioCard({ name, value, checked, onChange, title, description, disabled, extra }: {
  name: string; value: string; checked: boolean; onChange: () => void; title: string;
  description: string; disabled?: boolean; extra?: ReactNode;
}) {
  return (
    <label className={cn("relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors", checked ? "border-primary bg-secondary/40" : "border-border hover:border-primary/30", disabled && "cursor-not-allowed opacity-50")}>
      <input className="mt-0.5 size-4 shrink-0 accent-primary" type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      {extra}
    </label>
  );
}
