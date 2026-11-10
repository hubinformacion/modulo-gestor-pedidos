import { SelectField } from "@/components/ui/form-fields";

export function InboxSortFields({ fields, sort, dir }: {
  fields: { label: string; field: string }[]; sort: string; dir: string;
}) {
  return <details className="col-span-full md:hidden">
    <summary className="flex min-h-11 items-center text-sm font-medium text-primary">Ordenar resultados</summary>
    <div className="grid gap-3 pb-3 sm:grid-cols-2">
      <SelectField id="inbox-sort" name="sort" label="Ordenar por" defaultValue={sort}>
        {fields.map(({ field, label }) => <option key={field} value={field}>{label}</option>)}
      </SelectField>
      <SelectField id="inbox-direction" name="dir" label="Dirección" defaultValue={dir}>
        <option value="desc">Descendente</option><option value="asc">Ascendente</option>
      </SelectField>
    </div>
  </details>;
}
