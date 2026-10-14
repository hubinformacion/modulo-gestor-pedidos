import { DatePicker, type DatePickerProps } from "./date-picker";

export function DateField({ label, error, hint, id, ...props }: DatePickerProps & { label: string; error?: string; hint?: string }) {
  return <div><label htmlFor={id} className="mb-2 block text-xs font-medium">{label}</label><DatePicker {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />{hint && !error ? <p id={`${id}-hint`} className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p> : null}{error ? <p id={`${id}-error`} className="mt-2 text-xs leading-5 text-destructive">{error}</p> : null}</div>;
}

