"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, PlugZap } from "lucide-react";
import { checkGoogleIntegrationAction } from "@/app/admin/integration-actions";
import { notifyAction } from "@/components/feedback/notify-action";
import { Button } from "@/components/ui/button";
import type { IntegrationCheck } from "@/integrations/google/health";

type ConfigRow = { group: string; label: string; ready: boolean; detail: string };

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
    <div className="grid items-start gap-7 @min-[42rem]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @min-[42rem]:gap-8">
      {[...new Set(rows.map((row) => row.group))].map((group) => (
        <section key={group} className="min-w-0 border-t border-border pt-5 first:border-t-0 first:pt-0 @min-[42rem]:border-t-0 @min-[42rem]:pt-0">
          <h2 className="text-base font-semibold">{group}</h2>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {rows.filter((row) => row.group === group).map((row) => (
              <li key={row.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <div>
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.detail}</p>
                </div>
                <span className={`text-xs ${row.ready ? "text-muted-foreground" : "text-amber-800"}`}>
                  {row.ready ? "Configurado" : "Pendiente"}
                </span>
              </li>
            ))}
          </ul>
          {group === "Google" ? (
            <section aria-labelledby="check-google" className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 id="check-google" className="text-base font-semibold">Diagnóstico de Google</h2>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Comprueba token, carpeta, buzón y permisos.</p>
                </div>
                <Button variant="outline" disabled={pending} onClick={checkGoogle}>
                  <PlugZap aria-hidden="true" />{pending ? "Comprobando…" : "Comprobar conexión"}
                </Button>
              </div>
              {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
              {checks ? <ul className="mt-3 divide-y divide-border border-y border-border" aria-live="polite">
                {checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-3 py-3">
                    {check.ready ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-800" aria-hidden="true" />}
                    <div>
                      <p className="text-sm font-medium">{check.label} · {check.ready ? "Correcto" : "Requiere revisión"}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                    </div>
                  </li>
                ))}
              </ul> : null}
            </section>
          ) : null}
        </section>
      ))}
    </div>
  );
}
