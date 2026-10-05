"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="max-w-lg rounded-xl border border-border p-6 sm:p-8">
      <p className="text-xs font-medium text-muted-foreground">Intenta nuevamente</p>
      <h1 className="page-heading mt-3">No pudimos cargar esta página</h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">Comprueba tu conexión e intenta otra vez. Si tu acceso cambió, vuelve a iniciar sesión.</p>
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <Button className="h-10" onClick={reset}>Reintentar</Button>
        <Link className="text-sm text-primary underline underline-offset-4" href="/login">Volver al ingreso</Link>
      </div>
    </section>
  );
}
