"use client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function AdminError({ reset }: { reset: () => void }) {
  return <section role="alert" className="mx-auto max-w-md rounded-xl border border-border bg-white p-6"><h2 className="text-lg font-semibold">No pudimos cargar los datos</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Hubo un problema temporal. Puedes volver a intentarlo.</p><Button className="mt-5 h-10" onClick={reset}><RefreshCw className="size-4" />Volver a intentar</Button></section>;
}
