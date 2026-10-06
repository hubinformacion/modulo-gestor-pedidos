"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LoginButton({ configured }: { configured: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openExternally, setOpenExternally] = useState(false);

  async function signIn() {
    if (pending) return;
    if (window.parent !== window) {
      window.open(new URL("/login", window.location.origin), "_blank", "noopener,noreferrer");
      setOpenExternally(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider: "google", callbackURL: "/admin", errorCallbackURL: "/login",
      });
      if (result.error) throw new Error("SIGN_IN_FAILED");
    } catch {
      const message = "No se pudo iniciar sesión. Intenta nuevamente.";
      setError(message);
      sileo.error({ title: "Inicio de sesión no disponible", description: message });
      setPending(false);
    }
  }

  return (
    <div>
      <Button size="lg" className="h-11 w-full justify-between rounded-lg px-4 text-sm" disabled={!configured || pending} onClick={signIn}>
        <span>
          {pending ? "Conectando con Google…" : "Continuar con Google"}
        </span>
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>
      {openExternally ? <p className="mt-3 text-xs leading-6 text-muted-foreground">Continúa el ingreso en la nueva pestaña. Si no se abrió, <a href="/login" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">abre el acceso aquí</a>.</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
