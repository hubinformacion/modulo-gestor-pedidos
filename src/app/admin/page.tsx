import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MailCheck } from "lucide-react";
import { requirePageAccess } from "@/lib/access";
import { isMasterEmail } from "@/lib/access-policy";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const actor = await requirePageAccess();
  return (
    <>
      <p className="eyebrow text-muted-foreground">Espacio de trabajo</p>
      <h1 className="editorial-heading mt-4 text-4xl sm:text-5xl">Bienvenido, {actor.name.split(" ")[0]}.</h1>
      <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">Desde aquí puedes consultar quiénes tienen acceso al Fondo Editorial Continental.</p>
      <Link href="/admin/correos" className="mt-10 flex max-w-2xl items-start gap-5 border border-border bg-white/50 p-6 transition-colors hover:bg-secondary sm:p-8">
        <MailCheck className="mt-1 size-6 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
        <div className="flex-1">
          <h2 className="text-lg font-medium">Correos autorizados</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{isMasterEmail(actor.email) ? "Añade o revoca el acceso de los miembros del equipo." : "Consulta los correos que pueden ingresar al sistema."}</p>
        </div>
        <ArrowUpRight className="size-5 shrink-0" aria-hidden="true" />
      </Link>
    </>
  );
}
