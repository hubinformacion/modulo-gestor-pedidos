import Link from "next/link";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { requirePageAccess } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageAccess();
  return (
    <div className="min-h-svh">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-6 sm:px-10">
          <Link href="/admin" aria-label="Inicio del Fondo Editorial"><Brand compact /></Link>
          <div className="flex min-w-0 items-center gap-4">
            <p className="max-w-56 truncate text-xs text-muted-foreground" title={actor.email}>{actor.email}</p>
            <LogoutButton />
          </div>
        </div>
        <nav aria-label="Administración" className="mx-auto flex max-w-6xl gap-8 px-6 pb-4 text-sm sm:px-10">
          <Link className="hover:underline underline-offset-4" href="/admin">Inicio</Link>
          <Link className="hover:underline underline-offset-4" href="/admin/correos">Correos autorizados</Link>
        </nav>
      </header>
      <main id="contenido" className="enter-page mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16">{children}</main>
      <footer className="mx-auto max-w-6xl border-t border-border px-6 py-6 text-xs text-muted-foreground sm:px-10">Fondo Editorial Continental · Administración</footer>
    </div>
  );
}
