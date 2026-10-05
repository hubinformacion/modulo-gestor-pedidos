"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
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
      sileo.error({ title: "No se pudo cerrar sesión", description: "Intenta nuevamente." });
      setPending(false);
    }
  }

  return <Button variant="ghost" className="h-10" disabled={pending} onClick={signOut}><LogOut aria-hidden="true" />{pending ? "Cerrando…" : "Salir"}</Button>;
}
