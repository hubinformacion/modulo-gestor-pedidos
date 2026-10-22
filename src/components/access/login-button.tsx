"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/integrations/auth/client";

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
        provider: "google", callbackURL: "/acceso", errorCallbackURL: "/login",
      });
      if (result.error) throw new Error("SIGN_IN_FAILED");
    } catch {
      const message = "No pudimos iniciar la conexión con Google. Comprueba tu conexión y vuelve a intentarlo.";
      setError(message);
      sileo.error({ title: "Inicio de sesión no disponible", description: message, duration: 8000 });
      setPending(false);
    }
  }

  return (
    <div>
      <Button size="lg" variant="outline" className="h-12 w-full justify-center gap-3 rounded-lg border-input bg-white px-4 text-sm" disabled={!configured || pending} onClick={signIn}>
        {pending ? <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" /> : <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-3-.4-4.5H24v8.5h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.4Z" /><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-5l-6.6-5.2c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20.4 20.4 0 0 0 24 44Z" /><path fill="#FBBC05" d="M12.6 27.3a12.2 12.2 0 0 1 0-7.6v-5.3H5.8a20.4 20.4 0 0 0 0 18.2l6.8-5.3Z" /><path fill="#EA4335" d="M24 11.3c3 0 5.7 1 7.8 3l5.9-5.9A19.6 19.6 0 0 0 24 3 20.4 20.4 0 0 0 5.8 14.4l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z" /></svg>}
        <span>{pending ? "Conectando con Google…" : "Continuar con Google"}</span>
      </Button>
      {openExternally ? <p className="mt-3 text-xs leading-6 text-muted-foreground">Continúa el ingreso en la nueva pestaña. Si no se abrió, <a href="/login" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">abre el acceso aquí</a>.</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
