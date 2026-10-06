const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "America/Lima" });

export function DeliveryComplete({ deliveredAt }: { deliveredAt?: Date | null }) {
  return <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-white px-6 pb-9 pt-7 text-center sm:px-10 sm:pb-11">
    <div className="mx-auto w-64 max-w-full" aria-hidden="true">
      <svg viewBox="0 0 280 210" fill="none" className="block h-auto w-full">
        <ellipse cx="140" cy="109" rx="103" ry="87" fill="#f7f1fc" />
        <ellipse cx="140" cy="183" rx="78" ry="7" fill="#e9dcf5" />
        <path d="M64 142h137v27a8 8 0 0 1-8 8H72a8 8 0 0 1-8-8v-27Z" fill="#6802c1" />
        <path d="M76 148h121v21H76a10.5 10.5 0 0 1 0-21Z" fill="white" />
        <path d="M83 154h105m-105 8h105" stroke="#e9dcf5" strokeWidth="2" />
        <path d="M94 168v-20h14v20l-7-5-7 5Z" fill="#e4000b" />
        <path d="M81 109h135v27a7 7 0 0 1-7 7H89a8 8 0 0 1-8-8v-26Z" fill="#c9abe5" />
        <path d="M94 115h117v20H94a10 10 0 0 1 0-20Z" fill="white" />
        <path d="M101 121h102m-102 7h102" stroke="#e9dcf5" strokeWidth="2" />
        <path d="M67 100c26-12 51-12 73 0 23-12 49-12 74 0V55c-26-10-51-10-74 1-23-11-48-11-73-1v45Z" fill="white" stroke="#6802c1" strokeWidth="3" strokeLinejoin="round" />
        <path d="M140 56v44m-58-32c15-4 29-3 43 3m-43 11c15-4 29-3 43 3m30-14c14-6 28-7 43-3m-43 17c14-6 28-7 43-3" stroke="#c9abe5" strokeWidth="2" strokeLinecap="round" />
        <circle cx="211" cy="52" r="25" fill="#6802c1" stroke="white" strokeWidth="5" />
        <path d="m201 52 7 7 14-15" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M47 85v10m-5-5h10m174 48v10m-5-5h10" stroke="#c9abe5" strokeWidth="2" strokeLinecap="round" />
        <circle cx="83" cy="36" r="3" fill="#c9abe5" /><circle cx="239" cy="104" r="3" fill="#6802c1" />
      </svg>
    </div>
    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Entrega completada</p>
    <h2 className="mx-auto mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Tus próximas páginas<br />ya están contigo.</h2>
    <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-muted-foreground">Gracias por tu compra. Tu pedido está entregado; esperamos que disfrutes de cada lectura.</p>
    {deliveredAt ? <p className="mx-auto mt-6 inline-block rounded-full bg-secondary/60 px-4 py-2 text-xs font-medium text-primary">Entrega registrada el {dateFormat.format(deliveredAt)}</p> : null}
  </section>;
}
