import { readFile } from "node:fs/promises";
import { z } from "zod";

export const embedUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) && !url.username && !url.password;
}, "Usa HTTPS o un servidor local, sin credenciales en la URL.");
const escapeAttribute = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function renderWordPressEmbed(url: string) {
  const validUrl = embedUrlSchema.parse(url);
  const [template, script] = await Promise.all([
    readFile(new URL("./wordpress-embed.template.html", import.meta.url), "utf8"),
    readFile(new URL("./wordpress-embed.js", import.meta.url), "utf8"),
  ]);
  return template.replaceAll("__APP_URL__", escapeAttribute(validUrl)).replace("__RECEIVER_SCRIPT__", script.trim());
}
