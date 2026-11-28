import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

export async function createPdfPoster(file: File, signal: AbortSignal) {
  const data = await file.arrayBuffer();
  signal.throwIfAborted();
  GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = getDocument({ data, useWasm: false, useSystemFonts: true, enableXfa: false });
  let destroyed: Promise<void> | undefined;
  const destroy = () => { destroyed ??= task.destroy(); };
  signal.addEventListener("abort", destroy, { once: true });

  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1.25, 630 / Math.max(original.width, original.height)) });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    signal.removeEventListener("abort", destroy);
    destroy();
    await destroyed;
  }
}
