import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Original vector artwork. GIFs are generated locally, never during an email send.
const book = '<path d="M48 66c12-5 22-5 32 0 10-5 20-5 32 0V34c-12-5-22-5-32 0-10-5-20-5-32 0v32Zm32-32v32m-24-22 16 2m-16 8 16 2m16-10 16-2m-16 12 16-2"/>';
const check = '<circle cx="106" cy="34" r="14" fill="white"/><path d="m99 34 5 5 9-11"/>';
const icons = {
  received: '<rect x="56" y="23" width="48" height="53" rx="5"/><path d="M66 36h27M66 45h18M66 54h14"/>'+check,
  review: '<rect x="48" y="25" width="40" height="49" rx="5"/><path d="M57 37h21M57 46h15"/><circle cx="100" cy="55" r="18" fill="white"/><path d="M100 44v12l8 5"/>',
  verified: '<circle cx="80" cy="49" r="27"/><path d="m66 49 10 10 20-23"/>',
  rejected: '<rect x="56" y="23" width="48" height="53" rx="5"/><circle cx="107" cy="36" r="15" fill="white"/><path d="M107 28v10m0 6v1M66 39h25M66 49h17M66 59h23"/>',
  preparing: '<path d="m49 34 31-14 31 14v34L80 81 49 68V34Zm0 0 31 14 31-14M80 48v33m-16-54 31 14v12"/>',
  shipped: '<path d="M42 32h46v34H42V32Zm46 12h19l12 14v8H88V44Zm19 0v15h12"/><circle cx="56" cy="68" r="7" fill="white"/><circle cx="104" cy="68" r="7" fill="white"/><path d="M29 42h8m-12 9h12m-8 9h8"/>',
  pickup: book+'<path d="M121 24a10 10 0 1 0-20 0c0 8 10 18 10 18s10-10 10-18Z" fill="white"/><circle cx="111" cy="24" r="3"/>',
  delivered: book+check,
} as const;
const folder = new URL("./", import.meta.url);
await mkdir(folder, { recursive: true });
for (const [state, icon] of Object.entries(icons)) {
  const color = state === "rejected" ? "#e4000b" : "#6802c1";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96"><rect width="160" height="96" fill="white"/><ellipse cx="80" cy="49" rx="60" ry="40" fill="#faf6fd"/><g transform="translate(0,0)" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">${icon}<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="2.4s" repeatCount="2"/></g></svg>`;
  await writeFile(new URL(`${state}.svg`, folder), svg);
  const frames: Buffer[] = [];
  for (let index = 0; index < 16; index++) {
    const offset = (-3 * Math.sin(Math.PI * index / 15)).toFixed(2);
    const frame = svg.replace('transform="translate(0,0)"', `transform="translate(0,${offset})"`);
    frames.push(await sharp(Buffer.from(frame)).ensureAlpha().raw().toBuffer());
  }
  await sharp(Buffer.concat(frames), { raw: { width: 160, height: 96 * frames.length, channels: 4, pageHeight: 96 } }).gif({ loop: 2, delay: 150, colours: 64, dither: 0 }).toFile(new URL(`${state}.gif`, folder).pathname);
  console.log(`Ilustración generada: ${state}`);
}
