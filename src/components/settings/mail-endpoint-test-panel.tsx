"use client";

import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-fields";
import { sendMailEndpointTestAction } from "@/app/admin/mail-endpoint-test-actions";
import { mailEndpointTestSchema, maxMailTestPdfBytes, type MailEndpointTestResult } from "@/modules/settings/domain/mail-endpoint-test";

export function MailEndpointTestPanel({ configured }: { configured: boolean }) {
  const [pending, startTransition] = useTransition();
  const sending = useRef(false);
  const [result, setResult] = useState<MailEndpointTestResult | null>(null);
  const [error, setError] = useState("");

  return <section aria-labelledby="mail-test-title" className="mt-6 border-t border-border pt-6">
    <h3 id="mail-test-title" className="text-sm font-semibold">Prueba del nuevo servicio de correo</h3>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Envía una prueba a los correos que indiques y revisa su recepción. El mensaje admite HTML y un PDF opcional. Los adjuntos se utilizan solo para este envío.</p>
    {!configured ? <p role="status" className="mt-4 text-sm text-muted-foreground">La configuración del servicio está pendiente en el servidor. Completa las variables de entorno para habilitar la prueba.</p> : null}
    <form className="mt-5 max-w-3xl" aria-busy={pending} onSubmit={(event) => {
      event.preventDefault();
      if (sending.current) return;
      setError("");
      setResult(null);
      const data = new FormData(event.currentTarget);
      const parsed = mailEndpointTestSchema.safeParse({ to: data.get("to"), cc: data.get("cc"), bcc: data.get("bcc"), subject: data.get("subject"), html: data.get("html") });
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      const file = data.get("attachment");
      if (file instanceof File && (file.size > 0 || file.name) && (!file.size || file.size > maxMailTestPdfBytes || file.type !== "application/pdf" || !/\.pdf$/i.test(file.name) || file.name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(file.name))) {
        setError("Adjunta un PDF de hasta 3 MiB con un nombre válido de hasta 180 caracteres.");
        return;
      }
      sending.current = true;
      startTransition(async () => {
        try {
          if (file instanceof File && file.size > 0 && await file.slice(0, 5).text() !== "%PDF-") {
            setError("El archivo no tiene una firma PDF válida.");
            return;
          }
          setResult(await sendMailEndpointTestAction(data));
        }
        catch { setError("No se pudo confirmar el resultado. Comprueba el buzón antes de repetir la prueba."); }
        finally { sending.current = false; }
      });
    }}>
      <fieldset disabled={pending || !configured} className="space-y-5">
        <Field id="mail-test-to" name="to" label="Destinatario" type="email" autoComplete="off" maxLength={254} required />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="mail-test-cc" name="cc" label="CC (opcional)" autoComplete="off" maxLength={2600} hint="Separa los correos con punto y coma (;)." />
          <Field id="mail-test-bcc" name="bcc" label="CCO (opcional)" autoComplete="off" maxLength={2600} hint="Hasta diez destinatarios en total, incluidas las copias." />
        </div>
        <Field id="mail-test-subject" name="subject" label="Asunto" maxLength={200} required />
        <div>
          <label htmlFor="mail-test-html" className="mb-2 block text-xs font-medium">Mensaje</label>
          <textarea id="mail-test-html" name="html" rows={7} maxLength={30_000} required aria-describedby="mail-test-html-hint" className="w-full rounded-lg border border-input bg-white p-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 disabled:opacity-50" />
          <p id="mail-test-html-hint" className="mt-2 text-xs leading-5 text-muted-foreground">Texto o código HTML, hasta 30 000 caracteres.</p>
        </div>
        <Field id="mail-test-attachment" name="attachment" label="Adjunto PDF (opcional)" type="file" accept="application/pdf,.pdf" hint="Un archivo de hasta 3 MiB. Elige otro archivo para sustituirlo." className="h-auto min-h-11 py-2" />
        <Button type="submit" disabled={pending || !configured}><Send aria-hidden="true" />{pending ? "Enviando prueba…" : "Enviar correo de prueba"}</Button>
      </fieldset>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">El envío se realiza al pulsar el botón, sin copias automáticas a gestores. Esta prueba no cambia el proveedor de los avisos de pedidos.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
      {result ? <div role={result.success ? "status" : "alert"} className="mt-5 space-y-2 rounded-lg border border-border p-4">
        <p className={`text-sm font-semibold ${result.success ? "text-emerald-700" : "text-destructive"}`}>{result.success ? "Correo aceptado por el servicio" : "Envío sin confirmar"}</p>
        <p className="text-sm leading-6">{result.message}</p>
        {result.httpStatus !== undefined ? <p className="text-xs text-muted-foreground">Estado HTTP: {result.httpStatus}</p> : null}
        {result.providerMessageId ? <p className="break-all text-xs text-muted-foreground">Identificador del envío: {result.providerMessageId}</p> : null}
      </div> : null}
    </form>
  </section>;
}
