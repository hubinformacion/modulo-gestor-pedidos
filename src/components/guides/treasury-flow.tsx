import { ArrowDown, ArrowRight, Check, Inbox, ListChecks, MessageSquareWarning, Paperclip, RotateCcw, UserRoundCheck } from "lucide-react";
import type { GuideStep } from "@/components/guides/content";

const icons = [Inbox, UserRoundCheck, ListChecks, MessageSquareWarning, Paperclip, Check, RotateCcw];

export function TreasuryFlow({ steps, selected, id, onSelect }: {
  steps: GuideStep[];
  selected: number;
  id: string;
  onSelect: (index: number) => void;
}) {
  function node(index: number) {
    const Icon = icons[index];
    const step = steps[index];
    return <button type="button" id={`${id}-step-${index}`} aria-controls={`${id}-detail`}
      aria-pressed={selected === index} onClick={() => onSelect(index)}
      className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-white px-3 py-2 text-left text-sm font-semibold hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:text-primary">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      {step.title}
    </button>;
  }

  return <div className="mx-auto max-w-2xl">
    <div className="mx-auto max-w-lg">
      <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {node(0)}
        <ArrowRight className="hidden size-4 text-primary sm:block" aria-hidden="true" />
        <ArrowDown className="mx-auto size-4 text-primary sm:hidden" aria-hidden="true" />
        {node(1)}
      </div>
      <ArrowDown className="mx-auto my-2 size-4 text-primary" aria-hidden="true" />
      {node(2)}
    </div>
    <div className="relative grid gap-3 pt-5 sm:grid-cols-2 sm:gap-5 sm:pt-8">
      <div className="pointer-events-none absolute inset-x-1/4 top-0 hidden h-6 border-x border-b-0 border-t border-primary/30 sm:block" aria-hidden="true" />
      <div className="space-y-2 rounded-xl border border-primary/15 bg-secondary/35 p-3 sm:p-4">
        <h3 className="text-xs font-semibold text-primary">Si los datos están conformes</h3>
        {node(4)}
        <ArrowDown className="mx-auto size-4 text-primary" aria-hidden="true" />
        {node(5)}
        <div className="mt-3 space-y-2 border-t border-primary/15 pt-3">
          <p className="text-xs font-semibold">Si Fondo Editorial devuelve la emisión</p>
          {node(6)}
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><RotateCcw className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />Vuelve a tomar atención y emite la corrección.</p>
        </div>
      </div>
      <div className="self-start space-y-2 rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
        <h3 className="text-xs font-semibold">Si hay algo que corregir</h3>
        {node(3)}
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><RotateCcw className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />Cuando Fondo Editorial responda, vuelve a validar los datos.</p>
      </div>
    </div>
  </div>;
}
