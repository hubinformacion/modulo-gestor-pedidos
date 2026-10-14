"use client";
import { Children, Fragment, isValidElement, type ComponentProps, type ReactNode } from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
export type SelectOption = { value: string; label: ReactNode; disabled?: boolean };
export type SelectProps = Pick<ComponentProps<"button">, "id" | "className" | "disabled" | "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid" | "title" | "autoFocus"> & {
  name?: string; form?: string; required?: boolean; autoComplete?: string;
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void;
  children?: ReactNode; items?: SelectOption[];
};
function optionsFromChildren(children: ReactNode): SelectOption[] {
  const result: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return;
    if (child.type === Fragment) result.push(...optionsFromChildren(child.props.children));
    else if (child.type === "option") result.push({ value: String(child.props.value ?? ""), label: child.props.children, disabled: child.props.disabled });
  });
  return result;
}
export function Select({ children, items, value, defaultValue, onValueChange, name, form, required, autoComplete, disabled, className, id, ...triggerProps }: SelectProps) {
  const options = items ?? optionsFromChildren(children);
  return <SelectPrimitive.Root<string> key={value === undefined ? defaultValue : undefined} name={name} form={form} required={required} autoComplete={autoComplete} disabled={disabled} items={options} {...(value === undefined ? { defaultValue: defaultValue ?? options[0]?.value ?? null } : { value })} onValueChange={(next) => onValueChange?.(next ?? "")}>
    <SelectPrimitive.Trigger {...triggerProps} id={id} className={cn("app-select-trigger flex h-11 min-w-0 w-full items-center justify-between gap-3 rounded-lg border border-input bg-white px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50", className)}><SelectPrimitive.Value className="min-w-0 truncate" /><SelectPrimitive.Icon><ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>
    <SelectPrimitive.Portal><SelectPrimitive.Positioner className="app-select-positioner" alignItemWithTrigger={false} sideOffset={6} positionMethod="fixed"><SelectPrimitive.Popup className="app-select-popup"><SelectPrimitive.List>{options.map((item) => <SelectPrimitive.Item key={item.value} value={item.value} disabled={item.disabled} className="app-select-item"><SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText><SelectPrimitive.ItemIndicator className="ml-auto"><Check className="size-3.5" aria-hidden="true" /></SelectPrimitive.ItemIndicator></SelectPrimitive.Item>)}</SelectPrimitive.List></SelectPrimitive.Popup></SelectPrimitive.Positioner></SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
