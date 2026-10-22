"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Manual/focus refresh only: idle tabs must not keep Neon compute awake.
export function OrderLiveRefresh({ finished = false }: { finished?: boolean }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);
  const [pending, startTransition] = useTransition();
  const refreshing = useRef(false);
  const lastRefresh = useRef(0);
  useEffect(() => { refreshing.current = pending; }, [pending]);
  useEffect(() => {
    const update = () => setBlocked(Boolean(document.querySelector('[data-order-editing="true"]')));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.getElementById("app-content") ?? document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-order-editing"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (finished) return;
    lastRefresh.current = Date.now();
    function refresh() {
      if (refreshing.current || document.visibilityState !== "visible" || Date.now() - lastRefresh.current < 60_000 || document.querySelector('[data-order-editing="true"]') || document.activeElement?.closest("input,textarea,select")) return;
      refreshing.current = true;
      lastRefresh.current = Date.now();
      startTransition(() => router.refresh());
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [finished, router]);
  const label = pending ? "Actualizando datos…" : blocked ? "Finaliza la carga o edición antes de actualizar" : "Actualizar datos";
  return <Button type="button" variant="outline" size="icon" className="size-10 cursor-pointer text-primary" aria-label={label} title={label} aria-busy={pending} disabled={pending || blocked} onClick={() => {
    if (refreshing.current || document.querySelector('[data-order-editing="true"]')) return;
    refreshing.current = true;
    lastRefresh.current = Date.now();
    startTransition(() => router.refresh());
  }}><RefreshCw className="size-4" aria-hidden="true" /><span role="status" aria-live="polite" className="sr-only">{pending ? "Actualizando datos" : ""}</span></Button>;
}
