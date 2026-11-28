export default function SettingsLoading() {
  return (
    <div className="max-w-6xl" role="status" aria-busy="true">
      <span className="sr-only">Cargando configuración</span>
      <div className="motion-safe:animate-pulse" aria-hidden="true">
        <div className="space-y-3 border-b border-border pb-5">
          <div className="h-7 w-36 rounded bg-muted" />
          <div className="h-4 w-3/4 max-w-80 rounded bg-muted" />
        </div>
        <div className="mt-8 max-w-3xl divide-y divide-border border-y border-border">
          {[0, 1, 2].map((row) => <div key={row} className="flex items-center justify-between gap-6 py-4">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>)}
        </div>
      </div>
    </div>
  );
}
