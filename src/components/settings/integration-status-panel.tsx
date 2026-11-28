"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, PlugZap } from "lucide-react";
import { checkGoogleIntegrationAction } from "@/app/admin/integration-actions";
import { notifyAction } from "@/components/feedback/notify-action";
import { Button } from "@/components/ui/button";
import type { IntegrationCheck } from "@/integrations/google/health";

type ConfigRow = { group: "Publicación" | "Google"; label: string; ready: boolean; detail: string };

export function IntegrationStatusPanel({ rows }: { rows: ConfigRow[] }) {
  const [checks, setChecks] = useState<IntegrationCheck[] | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function checkGoogle() {
    setError("");
    startTransition(async () => {
      try {
        const result = await notifyAction(() => checkGoogleIntegrationAction({}), {
          loading: { title: "Comprobando Google", description: "Consultamos la autorización, Drive y Gmail." },
          success: { title: "Comprobación completada", description: "Consulta el resultado de cada servicio." },
          error: { title: "No se pudo comprobar", description: "Revisa la configuración y tu sesión antes de reintentar." },
        });
        setChecks(result.success ? result.checks : null);
        if (!result.success) setError(result.message);
      } catch {
        setChecks(null);
        setError("No se pudo completar la comprobación. Reintenta más tarde.");
      }
    });
  }

  return (
    <div className="grid items-start gap-5 @min-[47rem]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-6">
      <section aria-labelledby="google-integrations" className="min-w-0 overflow-hidden rounded-xl border border-border">
        <header className="border-b border-border bg-muted/60 px-4 py-4 sm:px-5">
          <h2 id="google-integrations" className="text-base font-semibold">Servicios de Google</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">OAuth, permisos de Drive y envío por Gmail.</p>
        </header>
        <ConfigStatusList rows={rows.filter((row) => row.group === "Google")} />
        <section aria-labelledby="check-google" className="border-t border-border px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 id="check-google" className="text-sm font-semibold">Diagnóstico de conexión</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Verifica acceso a la carpeta, al buzón y los permisos vigentes.</p>
            </div>
            <Button disabled={pending} onClick={checkGoogle}>
              <PlugZap aria-hidden="true" />{pending ? "Comprobando…" : "Comprobar conexión"}
            </Button>
          </div>
          {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
          {checks ? <ul className="mt-3 divide-y divide-border border-t border-border" aria-live="polite">
            {checks.map((check) => (
              <li key={check.label} className="flex items-start gap-3 py-3 last:pb-0">
                {check.ready ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-800" aria-hidden="true" />}
                <div>
                  <p className="text-sm font-medium">{check.label} · {check.ready ? "Correcto" : "Requiere revisión"}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul> : null}
        </section>
      </section>
      <section aria-labelledby="publishing-integrations" className="min-w-0 overflow-hidden rounded-xl border border-border">
        <header className="border-b border-border bg-muted/60 px-4 py-4 sm:px-5">
          <h2 id="publishing-integrations" className="text-base font-semibold">Publicación del portal</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Dirección pública e integración con WordPress.</p>
        </header>
        <ConfigStatusList rows={rows.filter((row) => row.group === "Publicación")} />
      </section>
    </div>
  );
}

function ConfigStatusList({ rows }: { rows: ConfigRow[] }) {
  return <ul className="divide-y divide-border px-4 sm:px-5">
    {rows.map((row) => (
      <li key={row.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{row.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.detail}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${row.ready ? "text-emerald-700" : "text-amber-800"}`}>
          {row.ready ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <CircleAlert className="size-3.5" aria-hidden="true" />}
          {row.ready ? "Configurado" : "Pendiente"}
        </span>
      </li>
    ))}
  </ul>;
}
