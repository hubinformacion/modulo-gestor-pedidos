import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, ArrowRight, MailCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { treasuryGuide } from "@/components/guides/content";

function SwimlaneRow({ title, treasury, editorial, step, handoff }: {
  title: string;
  treasury: string;
  editorial: string;
  step?: number;
  handoff?: "to-treasury" | "round-trip";
}) {
  const HandoffArrow = handoff === "round-trip" ? ArrowLeftRight : ArrowLeft;
  return <li className="treasury-guide-lanes">
    <div className="flex items-center gap-3 px-4 pb-2 pt-4 md:items-start md:px-5 md:py-5">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step !== undefined ? "bg-primary text-white" : "border border-primary/20 bg-white text-primary"}`}>
        {step === undefined ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <><span className="sr-only">Paso </span>{step}</>}
      </span>
      <h3 className="text-sm font-semibold leading-7 md:leading-5">{title}</h3>
    </div>
    <dl className="contents">
      <div className="min-w-0 px-4 pb-3 leading-6 md:border-s md:border-border md:p-5">
        <dt className="text-xs font-semibold text-primary md:sr-only">Tesorería Recaudación</dt>
        <dd className="mt-1 text-sm md:mt-0">{treasury}</dd>
      </div>
      <div className="relative min-w-0 bg-muted/40 px-4 py-3 leading-6 md:border-s md:border-border md:p-5">
        {handoff ? <span className="absolute -left-3 top-5 hidden size-6 items-center justify-center rounded-full border border-border bg-white text-primary md:flex" aria-hidden="true">
          <HandoffArrow className="size-3.5" />
        </span> : null}
        <dt className="text-xs font-semibold text-muted-foreground md:sr-only">Fondo Editorial</dt>
        <dd className="mt-1 text-sm text-muted-foreground md:mt-0">{editorial}</dd>
      </div>
    </dl>
  </li>;
}

export function TreasuryFlow({ service }: { service: boolean }) {
  return <div className="mt-7 space-y-6">
    {service ? <p className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-6">
      <ShieldCheck className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />Tu buzón tiene acceso de consulta. Usa una cuenta personal autorizada para atender y emitir.
    </p> : null}
    <section className="overflow-hidden rounded-xl border border-border bg-white" aria-labelledby="treasury-flow-title">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-5 sm:px-5">
        <h2 id="treasury-flow-title" className="text-lg font-semibold">De la solicitud a la emisión</h2>
        <Link href="/tesoreria-recaudacion" prefetch={false} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white">
          Abrir solicitudes <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div aria-hidden="true" className="treasury-guide-lanes hidden bg-secondary/45 text-xs font-semibold text-primary md:grid">
        <span className="p-4 md:px-5">Etapa</span>
        <span className="border-s border-border p-4 md:px-5">Tesorería Recaudación</span>
        <span className="border-s border-border p-4 md:px-5">Fondo Editorial</span>
      </div>
      <ol className="divide-y divide-border border-b border-border md:border-t">
        {treasuryGuide.stages.map((stage, index) => <SwimlaneRow key={stage.title} {...stage} step={index + 1} />)}
      </ol>
      <div className="flex items-start gap-3 border-b border-border px-4 py-4 text-sm leading-6 sm:px-5">
        <MailCheck className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p><strong className="font-semibold">El comprador recibe los documentos</strong> cuando se completan todas las emisiones del pedido. En un pedido mixto, un solo correo reúne los archivos de ambos sellos.</p>
      </div>
      <ul className="bg-secondary/25" aria-label="Flujo si devuelven la emisión">
        <SwimlaneRow {...treasuryGuide.returned} />
      </ul>
    </section>

    <aside className="grid items-start gap-5 lg:grid-cols-2">
      <section className="workspace-panel-section">
        <h2 className="text-sm font-semibold">Antes de continuar</h2>
        <ul className="mt-4 list-disc space-y-3 pl-4 text-xs leading-6">
          {treasuryGuide.reminders.map((reminder) => <li key={reminder}>{reminder}</li>)}
        </ul>
      </section>
      <section className="workspace-panel-section">
        <h2 className="mb-3 text-sm font-semibold">Preguntas frecuentes</h2>
        <div className="divide-y divide-border">{treasuryGuide.faq.map(({ question, answer }) => <details key={question} className="py-3">
          <summary className="text-xs font-medium leading-6">{question}</summary>
          <p className="mt-3 text-xs leading-7 text-muted-foreground">{answer}</p>
        </details>)}</div>
      </section>
    </aside>
  </div>;
}
