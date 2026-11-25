import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, MailCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { treasuryGuide } from "@/components/guides/content";

function Step({ number, title }: { number: number; title: string }) {
  return <div className="treasury-swimlane-node flex items-center gap-2 rounded-lg border border-border bg-white px-2 py-3 sm:gap-3 sm:px-4">
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white sm:size-7">
      <span className="sr-only">Paso </span>{number}
    </span>
    <span className="min-w-0 break-words text-sm font-semibold leading-tight sm:text-base">{title}</span>
  </div>;
}

function Handoff({ direction }: { direction: "right" | "left" | "both" }) {
  const Icon = direction === "right" ? ArrowRight : direction === "left" ? ArrowLeft : ArrowLeftRight;
  return <span className={`treasury-swimlane-handoff ${direction === "right" ? "" : "treasury-swimlane-handoff-conditional"}`} aria-hidden="true">
    <Icon className="relative size-5 bg-white sm:size-6" />
  </span>;
}

function Continue() {
  return <div className="treasury-swimlane-row" aria-hidden="true">
    <ArrowDown className="col-start-3 mx-auto my-1 size-5 text-primary" />
  </div>;
}

export function TreasuryFlow({ service }: { service: boolean }) {
  return <div className="mt-7 space-y-5">
    {service ? <p className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-6">
      <ShieldCheck className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />Tu buzón tiene acceso de consulta. Usa una cuenta personal autorizada para atender y emitir.
    </p> : null}
    <section className="rounded-xl border border-border bg-white p-4 sm:p-6" aria-labelledby="treasury-flow-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="treasury-flow-title" className="text-lg font-semibold">De la solicitud a la emisión</h2>
        <Link href="/tesoreria-recaudacion" prefetch={false} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white">
          Abrir solicitudes <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <figure className="treasury-swimlane mx-auto max-w-3xl px-0 pb-4 pt-3 sm:pb-6 sm:pt-4">
        <figcaption className="sr-only">Fondo Editorial verifica el pago y Tesorería toma la atención. Si hay un error en la revisión, Fondo Editorial responde a la observación y Tesorería vuelve a revisar. Si Fondo Editorial devuelve la emisión, Tesorería vuelve a tomar la atención.</figcaption>
        <div className="treasury-swimlane-row mb-4 text-center text-xs font-semibold leading-tight sm:text-sm">
          <p className="treasury-swimlane-node py-2 text-foreground">Fondo Editorial</p>
          <p className="treasury-swimlane-node col-start-3 py-2 text-primary">Tesorería Recaudación</p>
        </div>
        <div className="treasury-swimlane-row">
          <Step number={1} title="Verificar pago" />
          <Handoff direction="right" />
          <Step number={2} title="Tomar atención" />
        </div>
        <Continue />
        <div className="treasury-swimlane-row">
          <div className="treasury-swimlane-node rounded-lg border border-dashed border-border bg-white px-2 py-2 sm:px-4">
            <p className="text-xs font-medium text-muted-foreground">Si hay una observación</p>
            <p className="mt-1 text-sm font-semibold leading-tight">Responder observación</p>
          </div>
          <Handoff direction="both" />
          <Step number={3} title="Revisar datos y pago" />
        </div>
        <Continue />
        <div className="treasury-swimlane-row">
          <div className="col-start-3"><Step number={4} title="Adjuntar PDF y XML" /></div>
        </div>
        <Continue />
        <div className="treasury-swimlane-row">
          <div className="treasury-swimlane-node rounded-lg border border-dashed border-border bg-white px-2 py-2 sm:px-4">
            <p className="text-xs font-medium text-muted-foreground">Si requiere corrección</p>
            <p className="mt-1 text-sm font-semibold leading-tight">Devolver emisión</p>
            <p className="mt-1 flex items-start gap-1 text-xs font-medium leading-tight text-primary">
              <RotateCcw className="size-3 shrink-0" aria-hidden="true" />Retomar en el paso 2
            </p>
          </div>
          <Handoff direction="left" />
          <Step number={5} title="Finalizar solicitud" />
        </div>
        <Continue />
        <div className="treasury-swimlane-row">
          <div className="treasury-swimlane-node col-start-3 flex items-start gap-2 rounded-lg bg-primary px-2 py-3 text-white sm:gap-3 sm:px-4">
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 break-words"><p className="text-sm font-semibold leading-tight sm:text-base">Envío al comprador</p><p className="mt-1 text-xs leading-tight">Al completar todas las emisiones</p></div>
          </div>
        </div>
      </figure>
    </section>

    <section className="workspace-panel-section">
      <h2 className="sr-only">Material de consulta</h2>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">Instrucciones de cada etapa</summary>
        <ol className="mt-4 space-y-4 text-sm leading-6">
          {treasuryGuide.stages.map(({ title, treasury, editorial }) => <li key={title}>
            <h3 className="font-semibold">{title}</h3>
            <p>{treasury}</p>
            <p className="text-muted-foreground">{editorial}</p>
          </li>)}
        </ol>
        <h3 className="mt-4 text-sm font-semibold">{treasuryGuide.returned.title}</h3>
        <p className="text-sm leading-6">{treasuryGuide.returned.treasury}</p>
        <p className="text-sm leading-6 text-muted-foreground">{treasuryGuide.returned.editorial}</p>
        <ul className="mt-4 list-disc space-y-2 pl-4 text-xs leading-6">
          {treasuryGuide.reminders.map((reminder) => <li key={reminder}>{reminder}</li>)}
        </ul>
      </details>
      <details className="mt-3 border-t border-border pt-3">
        <summary className="cursor-pointer text-sm font-semibold">Preguntas frecuentes</summary>
        <div className="mt-3 divide-y divide-border">{treasuryGuide.faq.map(({ question, answer }) => <details key={question} className="py-3">
          <summary className="cursor-pointer text-xs font-medium leading-6">{question}</summary>
          <p className="mt-3 text-xs leading-7 text-muted-foreground">{answer}</p>
        </details>)}</div>
      </details>
    </section>
  </div>;
}
