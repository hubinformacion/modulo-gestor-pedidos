import Link from "next/link";
import { UsersRound } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { requirePageAccess } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageAccess();
  return (
    <div className="min-h-[24rem] bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-10">
          <Link href="/admin" className="text-sm font-semibold tracking-tight">Administración</Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="max-w-44 truncate text-xs text-muted-foreground sm:max-w-72" title={actor.email}>{actor.email}</span>
            <LogoutButton />
          </div>
        </div>
        <nav aria-label="Administración" className="mx-auto flex max-w-6xl px-6 sm:px-10">
          <Link href="/admin/correos" aria-current="page" className="-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 border-primary px-1 text-sm font-medium text-primary">
            <UsersRound className="size-4" aria-hidden="true" />
            Correos autorizados
          </Link>
        </nav>
      </header>
      <main id="contenido" className="enter-page mx-auto max-w-6xl px-6 py-8 sm:px-10 sm:py-10">{children}</main>
    </div>
  );
}
