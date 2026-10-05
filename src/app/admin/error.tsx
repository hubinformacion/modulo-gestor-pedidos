"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="max-w-lg border border-border p-8">
      <p className="eyebrow text-muted-foreground">Intenta nuevamente</p>
      <h1 className="editorial-heading mt-4 text-3xl">No pudimos cargar esta página.</h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">Comprueba tu conexión e intenta otra vez. Si tu acceso cambió, vuelve a iniciar sesión.</p>
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <Button className="h-10" onClick={reset}>Reintentar</Button>
        <Link className="text-sm underline underline-offset-4" href="/login">Volver al ingreso</Link>
      </div>
    </section>
  );
}
