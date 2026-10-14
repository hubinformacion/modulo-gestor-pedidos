import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
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
    <main id="contenido" className="login-surface">
      <section className="login-card enter-page" aria-labelledby="login-title">
        <div className="login-brand">
          {/* Local institutional SVG shared with the favicon and internal sidebar. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" width={48} height={48} alt="Universidad Continental" />
        </div>
        <div className="login-introduction"><p className="workspace-page-eyebrow">Plataforma de atención</p><h1 id="login-title">Iniciar sesión</h1><p>Ingresa para gestionar pedidos y solicitudes de emisión.</p></div>
        {message ? <p role="alert" className="mt-6 rounded-lg border border-border bg-muted p-4 text-xs leading-6">{message}</p> : null}
        <div className="mt-8"><LoginButton configured={configured} /></div>
        <div className="login-access-note"><ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" /><p>Acceso exclusivo para cuentas autorizadas. Si necesitas ingresar, contacta al administrador.</p></div>
      </section>
    </main>
  );
}
