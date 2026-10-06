import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Vector sources and transparent PNGs; generation is local, never during send.
const book = '<path d="M48 66c12-5 22-5 32 0 10-5 20-5 32 0V34c-12-5-22-5-32 0-10-5-20-5-32 0v32Zm32-32v32m-24-22 16 2m-16 8 16 2m16-10 16-2m-16 12 16-2"/>';
const check = '<circle cx="106" cy="34" r="14"/><path d="m99 34 5 5 9-11"/>';
const checkCutout = '<circle cx="106" cy="34" r="15" fill="black"/>';
const icons: Record<string, { body: string; overlay?: string; cutout?: string }> = {
  received: { body: '<rect x="56" y="23" width="48" height="53" rx="5"/><path d="M66 36h27M66 45h18M66 54h14"/>', overlay: check, cutout: checkCutout },
  review: { body: '<rect x="48" y="25" width="40" height="49" rx="5"/><path d="M57 37h21M57 46h15"/>', overlay: '<circle cx="100" cy="55" r="18"/><path d="M100 44v12l8 5"/>', cutout: '<circle cx="100" cy="55" r="19" fill="black"/>' },
  verified: { body: '<circle cx="80" cy="49" r="27"/><path d="m66 49 10 10 20-23"/>' },
  rejected: { body: '<rect x="56" y="23" width="48" height="53" rx="5"/><path d="M66 39h25M66 49h17M66 59h23"/>', overlay: '<circle cx="107" cy="36" r="15"/><path d="M107 28v10m0 6v1"/>', cutout: '<circle cx="107" cy="36" r="16" fill="black"/>' },
  preparing: { body: '<path d="m49 34 31-14 31 14v34L80 81 49 68V34Zm0 0 31 14 31-14M80 48v33m-16-54 31 14v12"/>' },
  shipped: { body: '<path d="M42 32h46v34H42V32Zm46 12h19l12 14v8H88V44Zm19 0v15h12M29 42h8m-12 9h12m-8 9h8"/>', overlay: '<circle cx="56" cy="68" r="7"/><circle cx="104" cy="68" r="7"/>', cutout: '<circle cx="56" cy="68" r="8" fill="black"/><circle cx="104" cy="68" r="8" fill="black"/>' },
  pickup: { body: book, overlay: '<path d="M121 24a10 10 0 1 0-20 0c0 8 10 18 10 18s10-10 10-18Z"/><circle cx="111" cy="24" r="3"/>', cutout: '<path d="M121 24a10 10 0 1 0-20 0c0 8 10 18 10 18s10-10 10-18Z" fill="black" stroke="black" stroke-width="3"/>' },
  delivered: { body: book, overlay: check, cutout: checkCutout },
};
const folder = new URL("./", import.meta.url);
await mkdir(folder, { recursive: true });
for (const [state, icon] of Object.entries(icons)) {
  const color = state === "rejected" ? "#e4000b" : "#6802c1";
  // A mask cuts out overlapped strokes without painting a white badge backing.
  const mask = icon.cutout ? `<defs><mask id="cutout" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="96"><rect width="160" height="96" fill="white"/>${icon.cutout}</mask></defs>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96">${mask}<g stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><g${icon.cutout ? ' mask="url(#cutout)"' : ""}>${icon.body}</g>${icon.overlay ?? ""}</g></svg>`;
  await writeFile(new URL(`${state}.svg`, folder), svg);
  await sharp(Buffer.from(svg)).png().toFile(new URL(`${state}.png`, folder).pathname);
  console.log(`Ilustración generada: ${state}`);
}
