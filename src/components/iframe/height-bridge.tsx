"use client";

import { useEffect } from "react";
import { iframeHeightSchema, iframeInitSchema } from "@/lib/iframe/protocol";

export function IframeHeightBridge({ allowedOrigins }: { allowedOrigins: string[] }) {
  useEffect(() => {
    if (window.parent === window) return;
    const content = document.getElementById("app-content");
    if (!content) return;
    const allowed = new Set([...allowedOrigins, window.location.origin]);
    let parentOrigin: string | null = null;
    let lastHeight = 0;
    let frame = 0;
    let disposed = false;
    try {
      const origin = new URL(document.referrer).origin;
      if (allowed.has(origin)) parentOrigin = origin;
    } catch { /* A no-referrer parent initializes the bridge with postMessage. */ }

    function sendHeight(force = false) {
      if (!parentOrigin || disposed) return;
      // Measuring the content avoids retaining the iframe's previous viewport
      // height when switching from a long catalog to a shorter wizard step.
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
      sendHeight(true);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    window.addEventListener("message", initialize);
    window.addEventListener("resize", schedule);
    void document.fonts.ready.then(schedule);
    schedule();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("message", initialize); window.removeEventListener("resize", schedule); };
  }, [allowedOrigins]);
  return null;
}
