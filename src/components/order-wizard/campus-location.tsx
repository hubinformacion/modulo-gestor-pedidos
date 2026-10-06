import { ExternalLink, MapPin } from "lucide-react";
import { campusMapUrls } from "@/lib/orders/campus-map";
import type { Campus } from "@/lib/orders/types";

export function CampusLocation({ campus }: { campus: Campus }) {
  const map = campusMapUrls(campus);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex gap-3 p-4">
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold">Biblioteca · {campus.name}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{campus.libraryAddress}</p>
          {campus.libraryLocation ? <p className="mt-2 text-xs font-medium">{campus.libraryLocation}</p> : null}
          <p className="mt-1 text-xs font-medium">Recojo del libro en la biblioteca</p>
        </div>
      </div>
      <iframe key={map.embedUrl} title={`Ubicación de la biblioteca del campus ${campus.name}`} src={map.embedUrl} width="100%" height="240" className="block w-full border-0 bg-muted" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        {map.approximate ? <p className="text-[11px] text-muted-foreground">Ubicación por dirección; confirma el punto de recojo.</p> : null}
        <a href={map.searchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-2 text-xs font-medium text-primary underline underline-offset-4">Abrir en Google Maps<ExternalLink className="size-3" aria-hidden="true" /></a>
      </div>
    </div>
  );
}
