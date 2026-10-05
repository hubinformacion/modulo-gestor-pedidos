import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
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
      ? "No se pudo autorizar el ingreso. Usa un correo autorizado o contacta al Fondo Editorial."
      : null;

  return (
    <main id="contenido" className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <section className="editorial-panel flex flex-col justify-between p-6 sm:p-8 lg:p-16">
        <Brand />
        <div className="enter-page hidden py-12 lg:block lg:py-20">
          <p className="eyebrow mb-6 text-primary">Conocimiento que trasciende</p>
          <h1 className="editorial-heading max-w-lg text-5xl sm:text-6xl lg:text-7xl">Cada libro abre<br />un nuevo camino.</h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">Un espacio para acompañar el trabajo editorial de la Universidad Continental y el Instituto Continental.</p>
          <div className="mt-12 flex h-44 items-end gap-2 sm:h-52" aria-hidden="true">
            <div className="book-spine h-full w-12 bg-[#c5d0b3]"><span>UNIVERSIDAD CONTINENTAL</span><span>01</span></div>
            <div className="book-spine h-[86%] w-16 bg-[#f4f0dd]"><span>FONDO EDITORIAL</span><span>CONOCIMIENTO</span></div>
            <div className="book-spine h-[94%] w-10 bg-primary text-white"><span>INSTITUTO CONTINENTAL</span><span>02</span></div>
            <div className="book-spine h-[78%] w-14 bg-[#b6c1a7]"><span>IDEAS QUE CONECTAN</span><span>CONTINENTAL</span></div>
            <div className="mb-0 ml-5 h-px flex-1 bg-primary/25" />
          </div>
        </div>
        <p className="eyebrow hidden text-primary/70 lg:block">Universidad · Instituto</p>
      </section>
      <section className="flex flex-col justify-between p-6 sm:p-8 lg:p-16">
        <p className="eyebrow text-muted-foreground lg:text-right">Administración editorial</p>
        <div className="enter-page mx-auto w-full max-w-sm py-10 lg:py-20">
          <span className="mb-6 flex size-12 items-center justify-center rounded-full border border-border text-primary" aria-hidden="true"><ShieldCheck className="size-5" strokeWidth={1.5} /></span>
          <h2 className="editorial-heading text-4xl">Bienvenido al equipo.</h2>
          <p className="mb-8 mt-4 text-sm leading-7 text-muted-foreground">Ingresa con tu cuenta de Google para acceder a la administración del Fondo Editorial.</p>
          {message ? <p role="alert" className="mb-5 rounded-lg border border-border bg-muted p-4 text-sm leading-6">{message}</p> : null}
          <LoginButton configured={configured} />
          <p className="mt-5 text-xs leading-6 text-muted-foreground">Acceso exclusivo para correos previamente autorizados. Si necesitas acceso, comunícate con el responsable de distribución.</p>
        </div>
        <p className="text-xs text-muted-foreground">Fondo Editorial Continental</p>
      </section>
    </main>
  );
}
