"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function OrderLiveRefresh({ finished = false }: { finished?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (finished) return;
    function refresh() {
      if (document.visibilityState !== "visible" || document.querySelector('[data-order-editing="true"]') || document.activeElement?.closest("input,textarea,select")) return;
      router.refresh();
    }
    const timer = window.setInterval(refresh, 35000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [finished, router]);
  return null;
}
