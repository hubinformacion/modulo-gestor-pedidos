"use client";

import { Button } from "@/components/ui/button";

export default function OrderError({ reset }: { reset: () => void }) {
  return (
    <main id="contenido" className="mx-auto max-w-6xl px-5 py-10 sm:px-10">
      <section role="alert" className="max-w-lg rounded-xl border border-border p-6">
        <h1 className="page-heading">No pudimos cargar las publicaciones</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Comprueba tu conexión e intenta nuevamente. Tu pedido aún no se ha registrado.</p>
        <Button className="mt-6 h-11 px-5" onClick={reset}>Reintentar</Button>
      </section>
    </main>
  );
}
