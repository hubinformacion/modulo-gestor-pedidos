import type { GuideStep } from "@/components/guides/content";

export const treasuryStepNumbers = ["1", "2", "3", "3A", "4", "5", "5A"] as const;

export function TreasuryFlow({ steps, selected, id, onSelect }: {
  steps: GuideStep[];
  selected: number;
  id: string;
  onSelect: (index: number) => void;
}) {
  function node(index: number) {
    const number = treasuryStepNumbers[index];
    return <button type="button" id={`${id}-step-${index}`} aria-controls={`${id}-detail`}
      aria-pressed={selected === index} onClick={() => onSelect(index)}
      className="group relative flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 text-left text-sm font-semibold hover:bg-secondary/50 aria-pressed:bg-secondary aria-pressed:text-primary">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-white text-xs tabular-nums text-primary group-aria-pressed:border-primary group-aria-pressed:bg-primary group-aria-pressed:text-white">
        <span className="sr-only">Paso </span>{number}
      </span>
      {steps[index].title}
    </button>;
  }

  return <ol className="relative isolate space-y-2 before:absolute before:inset-y-5 before:left-5 before:-z-10 before:w-px before:bg-border">
    <li>{node(0)}</li>
    <li>{node(1)}</li>
    <li>
      {node(2)}
      <div className="ml-10 mt-2 rounded-lg border border-dashed border-border bg-white p-2">
        <p className="px-1.5 text-xs font-medium text-muted-foreground">Si los datos o el pago requieren revisión</p>
        {node(3)}
        <p className="px-1.5 text-xs leading-5 text-muted-foreground">Con la respuesta de Fondo Editorial, vuelve al paso 3.</p>
      </div>
    </li>
    <li>{node(4)}</li>
    <li>
      {node(5)}
      <div className="ml-10 mt-2 rounded-lg border border-dashed border-border bg-white p-2">
        <p className="px-1.5 text-xs font-medium text-muted-foreground">Si Fondo Editorial devuelve la emisión</p>
        {node(6)}
        <p className="px-1.5 text-xs leading-5 text-muted-foreground">Vuelve a tomar atención en el paso 2.</p>
      </div>
    </li>
  </ol>;
}
