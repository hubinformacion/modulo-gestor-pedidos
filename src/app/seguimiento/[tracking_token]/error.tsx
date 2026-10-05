"use client";
import { Button } from "@/components/ui/button";
export default function TrackingError({ reset }: { reset: () => void }) {
  return <main id="contenido" className="mx-auto max-w-lg px-5 py-12"><h1 className="page-heading">Seguimiento temporalmente no disponible</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Conserva el enlace y tus comprobantes. Puedes volver a consultar.</p><Button className="mt-5" onClick={reset}>Reintentar</Button></main>;
}
