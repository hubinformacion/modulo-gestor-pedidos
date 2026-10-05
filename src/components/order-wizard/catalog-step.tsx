import { useState } from "react";
import { BookOpen, Minus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, toCents } from "@/lib/orders/money";
import { imprintNames, type CatalogBook, type CartSelection, type CustomerKind, type Imprint } from "@/lib/orders/types";
import { cn } from "@/lib/utils";

export function CatalogStep({ catalog, cart, customerType, onQuantity }: {
  catalog: CatalogBook[]; cart: CartSelection[]; customerType: CustomerKind;
  onQuantity: (book: CatalogBook, quantity: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Imprint | "todos">("todos");
  const term = search.trim().toLocaleLowerCase("es-PE");
  const filtered = catalog.filter((book) => (filter === "todos" || book.publisherImprint === filter) &&
    `${book.title} ${book.author} ${book.inventoryCode}`.toLocaleLowerCase("es-PE").includes(term));

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="book-search" className="sr-only">Buscar por título, autor o código</label>
        <Input id="book-search" type="search" className="h-11 pl-10" placeholder="Buscar título, autor o código" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="my-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar publicaciones por sello">
        {(["todos", "universidad", "instituto"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn("min-h-10 rounded-lg px-3 text-xs font-medium transition-colors", filter === value ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted")}>
            {value === "todos" ? "Todas" : value === "universidad" ? "Universidad" : "Instituto"}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">{filtered.length} {filtered.length === 1 ? "publicación" : "publicaciones"}</span>
      </div>
      {catalog.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <BookOpen className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 text-sm font-semibold">No hay publicaciones disponibles</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">El catálogo se actualizará pronto. Vuelve a consultar más adelante.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No encontramos publicaciones con esos filtros.</p>
          <Button variant="link" className="mt-3 h-10" onClick={() => { setSearch(""); setFilter("todos"); }}>Limpiar búsqueda</Button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((book) => {
            const quantity = cart.find((item) => item.bookId === book.id)?.quantity ?? 0;
            const community = customerType === "comunidad_continental";
            const price = toCents(community ? book.communityPrice : book.standardPrice);
            return (
              <li key={book.id} className={cn("grid gap-4 rounded-xl border p-4 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5", quantity ? "border-primary/45" : "border-border")}>
                <div className="flex items-start gap-4">

                  <div className="min-w-0 flex-1">
                    <span className={cn("inline-flex rounded-md px-2 py-1 text-[10px] font-medium", book.publisherImprint === "universidad" ? "bg-secondary text-primary" : "bg-muted text-muted-foreground")}>{imprintNames[book.publisherImprint]}</span>
                    <h3 className="mt-1.5 text-sm font-semibold leading-6">{book.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{book.author}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{book.inventoryCode} · {book.stock > 0 ? `${book.stock} disponibles` : "Agotado"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-4 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                  <div>
                    <p className="text-base font-semibold tabular-nums">{formatMoney(price)}</p>
                  </div>
                  {quantity ? (
                    <div className="flex items-center gap-1 rounded-lg border border-border p-0.5" role="group" aria-label={`Cantidad de ${book.title}`}>
                      <Button variant="ghost" size="icon" className="size-9" aria-label={`Quitar una unidad de ${book.title}`} onClick={() => onQuantity(book, quantity - 1)}><Minus aria-hidden="true" /></Button>
                      <span className="min-w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{quantity}</span>
                      <Button variant="ghost" size="icon" className="size-9" aria-label={`Añadir una unidad de ${book.title}`} disabled={quantity >= book.stock} onClick={() => onQuantity(book, quantity + 1)}><Plus aria-hidden="true" /></Button>
                    </div>
                  ) : (
                    <Button variant="outline" className="h-10 gap-2 px-4" disabled={book.stock < 1} onClick={() => onQuantity(book, 1)}><Plus aria-hidden="true" />{book.stock > 0 ? "Añadir" : "Agotado"}</Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
