"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, Eye, Mail, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/form-fields";
import { previewMailSampleAction, sendMailSampleAction } from "@/app/admin/mail-template-actions";
import { mailSampleOptions, mailSampleSelectionSchema, mailSampleSendSchema, type MailSampleKey, type MailSamplePreview } from "@/modules/settings/domain/mail-samples";
import type { MailEndpointTestResult } from "@/modules/settings/domain/mail-endpoint-test";

const templates = (Object.keys(mailSampleOptions) as MailSampleKey[]).map((key, index) => ({
  key,
  number: String(index + 1).padStart(2, "0"),
  ...mailSampleOptions[key],
}));

export function MailTemplateGallery({ endpointConfigured, activeProvider }: { endpointConfigured: boolean; activeProvider: "gmail" | "endpoint" }) {
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [operation, setOperation] = useState<"preview" | "send" | null>(null);
  const [provider, setProvider] = useState<string>(activeProvider);
  const [template, setTemplate] = useState(templates[0]);
  const [preview, setPreview] = useState<MailSamplePreview | null>(null);
  const [result, setResult] = useState<MailEndpointTestResult | null>(null);
  const [error, setError] = useState("");
  const endpointUnavailable = provider === "endpoint" && !endpointConfigured;
  const treasury = template.key === "TESORERIA_EMISION";
  const hasBilling = treasury || template.key === "DOCUMENTOS_VENTA" || template.key === "DOCUMENTOS_CORREGIDOS";
  const hasDelivery = treasury || template.key === "DESPACHADO";
  const hasImprint = hasBilling || ["PEDIDO_RECIBIDO", "COMPROBANTE_RECIBIDO", "PAGO_RECHAZADO", "PAGO_VERIFICADO"].includes(template.key);

  function clearPreview() {
    setPreview(null);
    setResult(null);
    setError("");
  }

  function runOperation(next: "preview" | "send") {
    if (busy.current || !formRef.current) return;
    const data = new FormData(formRef.current);
    const selection = {
      template: template.key,
      variant: data.get("variant") ?? "universidad",
      delivery: data.get("delivery") ?? "delivery",
      billing: data.get("billing") ?? "boleta",
    };
    const parsed = next === "preview"
      ? mailSampleSelectionSchema.safeParse(selection)
      : mailSampleSendSchema.safeParse({ ...selection, destination: data.get("destination"), provider });
    setError("");
    setResult(null);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    busy.current = true;
    setOperation(next);
    if (next === "preview") setPreview(null);
    startTransition(async () => {
      try {
        if (next === "preview") {
          const response = await previewMailSampleAction(parsed.data);
          if (response.success) setPreview(response.preview);
          else setError(response.message);
        } else {
          setResult(await sendMailSampleAction(parsed.data));
        }
      } catch {
        setError(next === "send" ? "No se pudo confirmar el envío. Comprueba el buzón antes de repetir la prueba." : "No se pudo generar la vista previa. Revisa tu sesión y vuelve a intentarlo.");
      } finally {
        busy.current = false;
        setOperation(null);
      }
    });
  }

  return (
    <section aria-labelledby="mail-gallery-title" className="min-w-0 rounded-xl border border-border bg-white">
      <header className="border-b border-border bg-muted/40 px-4 py-4 sm:px-6">
        <h2 id="mail-gallery-title" className="text-base font-semibold">Plantillas de correo</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Consulta los avisos del flujo o envía una prueba con datos ficticios.</p>
      </header>
      <div className="grid @min-[52rem]:grid-cols-[minmax(19rem,.8fr)_minmax(0,1.55fr)]">
        <form ref={formRef} className="min-w-0 p-4 sm:p-6" aria-busy={pending} onSubmit={(event) => { event.preventDefault(); runOperation("send"); }}>
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            <SelectField id="mail-sample-template" label="Aviso del flujo" title={template.label} value={template.key} onValueChange={(value) => {
              const selected = templates.find(({ key }) => key === value);
              if (!selected) return;
              setTemplate(selected);
              clearPreview();
            }}>
              {templates.map(({ key, number, label }) => <option key={key} value={key}>{number} · {label}</option>)}
            </SelectField>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-primary">{template.stage}</p>
              {treasury ? <p className="text-xs leading-5 text-muted-foreground">Se envía un correo por sello tras verificar su pago. Tesorería responde por correo con el PDF y el XML.</p> : null}
            </div>
            {hasImprint ? (
              <SelectField key={treasury ? "treasury" : "order"} id="mail-sample-variant" name="variant" label="Sello" defaultValue="universidad" onValueChange={clearPreview}>
                <option value="universidad">Universidad</option>
                <option value="instituto">Instituto</option>
                {!treasury ? <option value="mixto">Mixto</option> : null}
              </SelectField>
            ) : null}
            {hasDelivery ? (
              <SelectField id="mail-sample-delivery" name="delivery" label="Entrega" defaultValue="delivery" onValueChange={clearPreview}>
                <option value="delivery">Envío a domicilio</option><option value="recojo_campus">Recojo en campus</option>
              </SelectField>
            ) : null}
            {hasBilling ? (
              <SelectField id="mail-sample-billing" name="billing" label="Documento de venta" defaultValue="boleta" onValueChange={clearPreview}>
                <option value="boleta">Boleta</option><option value="factura">Factura</option>
              </SelectField>
            ) : null}
            <Button type="button" variant="outline" className="h-10" disabled={pending} onClick={() => runOperation("preview")}>
              <Eye aria-hidden="true" />{pending && operation === "preview" ? "Generando vista previa…" : "Ver vista previa"}
            </Button>
            <details className="group border-t border-border pt-3">
              <summary className="flex list-none items-center justify-between gap-2 text-sm font-semibold marker:content-none">
                Enviar una prueba
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 space-y-3">
                <Field id="mail-sample-destination" name="destination" label="Destinatario de prueba" type="email" autoComplete="off" maxLength={254} />
                <SelectField id="mail-sample-provider" label="Servicio de envío" value={provider} onValueChange={(value) => { setProvider(value); setResult(null); }}>
                  <option value="gmail">Gmail</option><option value="endpoint">Servicio institucional</option>
                </SelectField>
                <p className="text-xs leading-5 text-muted-foreground">Solo el destinatario indicado recibirá la prueba. El asunto llevará la marca [PRUEBA].</p>
                {endpointUnavailable ? <p role="status" className="text-xs leading-5 text-muted-foreground">Configura el servicio institucional para habilitar el envío de pruebas.</p> : null}
                <Button type="submit" className="h-10" disabled={pending || endpointUnavailable}>
                  <Send aria-hidden="true" />{pending && operation === "send" ? "Enviando prueba…" : "Enviar correo de prueba"}
                </Button>
              </div>
            </details>
          </fieldset>
          {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
          {result ? (
            <div role={result.success ? "status" : "alert"} className="mt-4 space-y-2 rounded-lg border border-border p-3">
              <p className={`text-sm font-semibold ${result.success ? "text-emerald-700" : "text-destructive"}`}>{result.success ? "Correo de prueba aceptado" : "Envío sin confirmar"}</p>
              <p className="text-sm leading-6">{result.message}</p>
              {result.httpStatus !== undefined ? <p className="text-xs text-muted-foreground">Estado HTTP: {result.httpStatus}</p> : null}
              {result.providerMessageId ? <p className="break-all text-xs text-muted-foreground">Identificador del envío: {result.providerMessageId}</p> : null}
            </div>
          ) : null}
        </form>
        <section aria-labelledby="mail-sample-preview-title" className="min-w-0 rounded-b-xl border-t border-border bg-muted/50 p-4 sm:p-6 @min-[52rem]:rounded-bl-none @min-[52rem]:border-l @min-[52rem]:border-t-0">
          <h3 id="mail-sample-preview-title" className="text-sm font-semibold">Vista previa</h3>
          <div aria-live="polite">
            {preview ? (
              <>
                <p className="mt-3 break-words text-sm"><span className="font-semibold">Asunto: </span>[PRUEBA] {preview.subject}</p>
                {preview.attachmentNames.length ? (
                  <ul aria-label="Archivos adjuntos" className="mt-2 flex flex-wrap gap-1.5">
                    {preview.attachmentNames.map((name) => (
                      <li key={name} className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-xs">
                        <Paperclip aria-hidden="true" className="size-3 shrink-0" /><span className="break-all">{name}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-xs text-muted-foreground">Sin adjuntos</p>}
              </>
            ) : (
              <div className="mt-3 flex items-start gap-3 border-t border-border pt-4">
                <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">{operation === "preview" ? "Generando el ejemplo de correo…" : "Selecciona un aviso y abre su vista previa para consultar el mensaje y sus adjuntos."}</p>
              </div>
            )}
          </div>
          {preview ? <iframe title="Vista previa del correo de prueba con datos ficticios" sandbox="" srcDoc={preview.html} referrerPolicy="no-referrer" className="mt-4 h-[min(38rem,75dvh)] min-h-80 w-full rounded-lg border border-border bg-white" /> : null}
        </section>
      </div>
    </section>
  );
}
