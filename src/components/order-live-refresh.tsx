"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// No periodic polling: an idle tab must not keep Neon compute awake.
export function OrderLiveRefresh({ finished = false }: { finished?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (finished) return;
    let lastRefresh = Date.now();
    function refresh() {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh < 60_000 || document.querySelector('[data-order-editing="true"]') || document.activeElement?.closest("input,textarea,select")) return;
      lastRefresh = Date.now();
      router.refresh();
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [finished, router]);
  return null;
}
