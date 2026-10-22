"use client";
export function scrollWizardTo(element: HTMLElement | null, focus?: HTMLElement | null) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!element?.isConnected) return;
    focus?.focus({ preventScroll: true });
    element.scrollIntoView({ behavior: "instant", block: "start" });
    // The bridge forwards only a coordinate to the validated WordPress parent.
    document.dispatchEvent(new CustomEvent("fec:scroll-to", { detail: { top: Math.max(0, Math.ceil(element.getBoundingClientRect().top + window.scrollY)) } }));
  }));
}
