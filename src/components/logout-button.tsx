"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("SIGN_OUT_FAILED");
      router.replace("/login");
      router.refresh();
    } catch {
      sileo.error({ title: "No se pudo cerrar sesión", description: "Vuelve a intentar cerrar sesión. Si el error persiste, actualiza esta página.", duration: 8000 });
      setPending(false);
    }
  }

  return <Button variant="destructive" className="workspace-signout h-10" title={compact ? "Cerrar sesión" : undefined} disabled={pending} onClick={signOut}><LogOut aria-hidden="true" /><span className={compact ? "sr-only" : undefined}>{pending ? "Cerrando sesión…" : "Cerrar sesión"}</span></Button>;
}
