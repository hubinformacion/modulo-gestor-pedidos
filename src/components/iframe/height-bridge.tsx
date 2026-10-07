"use client";
import { useEffect } from "react";
import { iframeHeightSchema, iframeInitSchema, iframeScrollSchema } from "@/lib/iframe/protocol";

export function IframeHeightBridge({ allowedOrigins }: { allowedOrigins: string[] }) {
  // RSC refreshes produce new arrays. Keep the connection while their values
  // remain identical, including after navigating from wizard to tracking.
  const originsKey = JSON.stringify(allowedOrigins);
  useEffect(() => {
    if (window.parent === window) return;
    const content = document.getElementById("app-content");
    if (!content) return;
    const allowed = new Set<string>([...JSON.parse(originsKey), window.location.origin]);
    let parentOrigin: string | null = null;
    let supportsScroll = false;
    let lastHeight = 0;
    let frame = 0;
    let disposed = false;
    const root = document.documentElement;
    try { const origin = new URL(document.referrer).origin; if (allowed.has(origin)) parentOrigin = origin; }
    catch { /* The validated parent handshake works with no-referrer. */ }
    function sendHeight(force = false) {
      if (!parentOrigin || disposed) return;
      const height = Math.max(128, Math.ceil(content!.getBoundingClientRect().height));
      const message = iframeHeightSchema.safeParse({ type: "fec:iframe:height", version: 1, height });
      if (!message.success || (!force && height === lastHeight)) return;
      lastHeight = height;
      window.parent.postMessage(message.data, parentOrigin);
    }
    function schedule() { if (disposed) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(() => sendHeight()); }
    function initialize(event: MessageEvent) {
      if (event.source !== window.parent || !allowed.has(event.origin) || !iframeInitSchema.safeParse(event.data).success) return;
      parentOrigin = event.origin;
      supportsScroll = Array.isArray(event.data?.capabilities) && event.data.capabilities.includes("scroll");
      root.dataset.fecEmbedded = "true";
      sendHeight(true); schedule();
    }
    function scrollTo(event: Event) {
      if (!parentOrigin || !supportsScroll || disposed || root.dataset.fecEmbedded !== "true") return;
      const message = iframeScrollSchema.safeParse({ type: "fec:iframe:scroll", version: 1, top: (event as CustomEvent).detail?.top });
      if (message.success) { sendHeight(true); window.parent.postMessage(message.data, parentOrigin); }
    }
    document.addEventListener("fec:scroll-to", scrollTo);
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    window.addEventListener("message", initialize);
    window.addEventListener("resize", schedule);
    document.addEventListener("load", schedule, true);
    void document.fonts.ready.then(schedule);
    // Reconnect even when hydration takes longer than the parent's first retry
    // window. Each message has an exact allowed target, never a wildcard.
    for (const origin of allowed) window.parent.postMessage({ type: "fec:iframe:ready", version: 1 }, origin);
    schedule();
    return () => {
      disposed = true; observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("message", initialize); window.removeEventListener("resize", schedule);
      document.removeEventListener("fec:scroll-to", scrollTo);
      document.removeEventListener("load", schedule, true); delete root.dataset.fecEmbedded;
    };
  }, [originsKey]);
  return null;
}
