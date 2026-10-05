"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LoginButton({ configured }: { configured: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (pending) return;
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
      <Button size="lg" className="h-12 w-full justify-between px-5 text-sm" disabled={!configured || pending} onClick={signIn}>
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-white text-sm font-semibold text-primary">G</span>
          {pending ? "Conectando con Google…" : "Continuar con Google"}
        </span>
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
      </Button>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
