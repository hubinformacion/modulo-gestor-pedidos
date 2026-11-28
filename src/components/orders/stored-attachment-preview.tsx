"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

const OrderFilePond = dynamic(() => import("./filepond").then((module) => module.OrderFilePond), { ssr: false });

export function StoredAttachmentPreview({ url, name }: { url: string; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const entries = useMemo(() => [{ src: url, name }], [url, name]);

  useEffect(() => {
    if (!host.current || visible) return;
    // Hidden order steps and closed history do not request private file bytes.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "120px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [visible]);

  return <div ref={host} className="mt-2 min-h-10 min-w-0">
    {visible ? <OrderFilePond label={`Vista previa de ${name}`} mode="readonly" entries={entries} /> : null}
  </div>;
}
