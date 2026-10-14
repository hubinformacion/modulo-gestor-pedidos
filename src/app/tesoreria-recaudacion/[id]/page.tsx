import { notFound, redirect } from "next/navigation";
import { z } from "zod";
export default async function LegacyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  redirect(`/tesoreria-recaudacion/solicitudes/${id.data}`);
}
