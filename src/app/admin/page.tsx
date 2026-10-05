import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/access";

export default async function AdminPage() {
  await requirePageAccess();
  redirect("/admin/correos");
}
