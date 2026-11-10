"use client";

import { useRef, useState, useTransition } from "react";
import { Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/form-fields";
import { previewMailSampleAction, sendMailSampleAction } from "@/app/admin/mail-template-actions";
import { mailSampleOptions, mailSampleSelectionSchema, mailSampleSendSchema, type MailSamplePreview } from "@/modules/settings/domain/mail-samples";
import type { MailEndpointTestResult } from "@/modules/settings/domain/mail-endpoint-test";

export function MailTemplateGallery({ endpointConfigured, activeProvider }: { endpointConfigured: boolean; activeProvider: "gmail" | "endpoint" }) {
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [operation, setOperation] = useState<"preview" | "send" | null>(null);
  const [provider, setProvider] = useState<string>("gmail");
  const [preview, setPreview] = useState<MailSamplePreview | null>(null);
  const [result, setResult] = useState<MailEndpointTestResult | null>(null);
  const [error, setError] = useState("");
  const endpointUnavailable = provider === "endpoint" && !endpointConfigured;

  function runOperation(next: "preview" | "send") {
    if (busy.current || !formRef.current) return;
    const data = new FormData(formRef.current);
    const selection = { template: data.get("template"), variant: data.get("variant"), delivery: data.get("delivery"), billing: data.get("billing") };
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

  return <section aria-labelledby="mail-gallery-title">
    <h2 id="mail-gallery-title" className="text-lg font-semibold tracking-tight">Plantillas de correo</h2>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Revisa los mensajes del sistema con datos ficticios y envía una prueba individual al correo que indiques. Los enlaces del ejemplo están desactivados.</p>
    <form ref={formRef} className="mt-6" aria-busy={pending} onSubmit={(event) => { event.preventDefault(); runOperation("send"); }}>
      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <SelectField id="mail-sample-template" name="template" label="Plantilla" defaultValue="PEDIDO_RECIBIDO" onValueChange={() => { setPreview(null); setResult(null); }}>
            {Object.entries(mailSampleOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </SelectField>
          <SelectField id="mail-sample-variant" name="variant" label="Sello" defaultValue="universidad" onValueChange={() => { setPreview(null); setResult(null); }}>
            <option value="universidad">Universidad</option><option value="instituto">Instituto</option><option value="mixto">Mixto</option>
          </SelectField>
          <SelectField id="mail-sample-delivery" name="delivery" label="Entrega" defaultValue="delivery" onValueChange={() => { setPreview(null); setResult(null); }}>
            <option value="delivery">Delivery</option><option value="recojo_campus">Recojo en campus</option>
          </SelectField>
          <SelectField id="mail-sample-billing" name="billing" label="Comprobante de venta" defaultValue="boleta" onValueChange={() => { setPreview(null); setResult(null); }}>
            <option value="boleta">Boleta</option><option value="factura">Factura</option>
          </SelectField>
        </div>
        <Button type="button" variant="outline" disabled={pending} onClick={() => runOperation("preview")}><Eye aria-hidden="true" />{pending && operation === "preview" ? "Generando vista previa…" : "Ver vista previa"}</Button>
        <div className="border-t border-border pt-5">
          <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
            <Field id="mail-sample-destination" name="destination" label="Destinatario de prueba" type="email" autoComplete="off" maxLength={254} hint="Solo este correo recibirá la prueba, sin copias automáticas." />
            <SelectField id="mail-sample-provider" label="Servicio de envío de prueba" value={provider} onValueChange={(value) => { setProvider(value); setResult(null); }}>
              <option value="gmail">Gmail{activeProvider === "gmail" ? " · activo" : ""}</option>
              <option value="endpoint">Servicio institucional{activeProvider === "endpoint" ? " · activo" : ""}</option>
            </SelectField>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Esta selección solo se aplica a la prueba. El asunto llevará la marca [PRUEBA].</p>
          {endpointUnavailable ? <p role="status" className="mt-3 text-sm text-muted-foreground">Completa la configuración del servicio institucional en el servidor para habilitar sus envíos de prueba.</p> : null}
          <Button className="mt-4" type="submit" disabled={pending || endpointUnavailable}><Send aria-hidden="true" />{pending && operation === "send" ? "Enviando prueba…" : "Enviar correo de prueba"}</Button>
        </div>
      </fieldset>
      {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
      {result ? <div role={result.success ? "status" : "alert"} className="mt-5 space-y-2 rounded-lg border border-border p-4">
        <p className={`text-sm font-semibold ${result.success ? "text-emerald-700" : "text-destructive"}`}>{result.success ? "Correo de prueba aceptado" : "Envío sin confirmar"}</p>
        <p className="text-sm leading-6">{result.message}</p>
        {result.httpStatus !== undefined ? <p className="text-xs text-muted-foreground">Estado HTTP: {result.httpStatus}</p> : null}
        {result.providerMessageId ? <p className="break-all text-xs text-muted-foreground">Identificador del envío: {result.providerMessageId}</p> : null}
      </div> : null}
    </form>
    {preview ? <section aria-labelledby="mail-sample-preview-title" className="mt-7 border-t border-border pt-6">
      <h3 id="mail-sample-preview-title" className="text-sm font-semibold">Vista previa</h3>
      <p className="mt-3 break-words text-sm"><span className="font-medium">Asunto: </span>[PRUEBA] {preview.subject}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{preview.attachmentNames.length ? `Adjuntos: ${preview.attachmentNames.join(", ")}` : "Sin adjuntos PDF."}</p>
      <iframe title="Vista previa del correo de prueba con datos ficticios" sandbox="" srcDoc={preview.html} referrerPolicy="no-referrer" className="mt-4 h-[640px] w-full rounded-lg border border-border bg-white" />
    </section> : <p className="mt-7 text-sm leading-6 text-muted-foreground">Selecciona una plantilla y pulsa Ver vista previa para revisar su contenido.</p>}
  </section>;
}
