import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { LoginButton } from "@/components/login-button";
import { isAuthConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const configured = isAuthConfigured();
  const message = !configured || error === "service_unavailable"
    ? "El inicio de sesión está temporalmente no disponible. Intenta más tarde."
    : error
      ? "No se pudo autorizar el ingreso. Usa un correo autorizado o contacta al administrador."
      : null;

  return (
    <main id="contenido" className="flex min-h-[32rem] items-center justify-center px-6 py-14 sm:py-20">
      <section className="enter-page w-full max-w-sm" aria-labelledby="login-title">
        <span className="mb-6 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary" aria-hidden="true">
          <LockKeyhole className="size-5" strokeWidth={1.75} />
        </span>
        <h1 id="login-title" className="page-heading">Iniciar sesión</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Usa tu cuenta de Google para acceder al sistema.
        </p>
        {message ? (
          <p role="alert" className="mt-6 rounded-lg border border-border bg-muted p-4 text-sm leading-6">{message}</p>
        ) : null}
        <div className="mt-7"><LoginButton configured={configured} /></div>
        <div className="mt-7 border-t border-border pt-5">
          <p className="text-xs leading-6 text-muted-foreground">
            Tu correo debe estar autorizado previamente. Si necesitas acceso, contacta al administrador.
          </p>
        </div>
      </section>
    </main>
  );
}
