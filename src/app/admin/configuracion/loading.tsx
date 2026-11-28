export default function SettingsLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Cargando configuración</span>
      <div className="@container motion-safe:animate-pulse" aria-hidden="true">
        <div className="space-y-3 border-b border-border pb-5">
          <div className="h-8 w-36 rounded bg-muted" />
          <div className="h-4 w-3/4 max-w-80 rounded bg-muted" />
        </div>
        <div className="mt-5 grid items-start gap-5 @min-[43rem]:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)] sm:mt-6 sm:gap-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-muted/60 px-5 py-4">
              <div className="h-4 w-28 rounded bg-muted" />
            </div>
            <div className="divide-y divide-border px-5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between gap-6 py-4">
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 rounded-xl border border-border bg-muted/40 p-5">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-10 rounded-lg bg-muted" />
            <div className="h-8 w-24 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
