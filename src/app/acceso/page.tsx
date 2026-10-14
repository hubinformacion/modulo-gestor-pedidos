import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withDatabase } from "@/db";
import { getSignedInSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";
export const dynamic = "force-dynamic";
export default async function AccessPage() {
  const requestHeaders = await headers();
  const actor = await withDatabase((db) => getSignedInSession(db, requestHeaders)).catch((error: unknown) => {
    if (error instanceof AccessError && error.code !== "UNAVAILABLE") redirect("/login");
    throw error;
  });
  redirect(actor.role === "caja" ? "/tesoreria-recaudacion" : "/admin/pedidos");
}
