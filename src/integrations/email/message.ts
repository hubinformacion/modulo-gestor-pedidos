import { randomUUID } from "node:crypto";
import "server-only";
import { readMailLogo } from "./logo";
import type { MailAttachment } from "./types";
function attachmentName(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
function base64Lines(value: Buffer) { return value.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? ""; }
export async function buildEmailMessage({ headers, html, text, attachment, attachments = [], logoCid }: { headers: string[]; html: string; text: string; attachment?: MailAttachment; attachments?: MailAttachment[]; logoCid: string }) {
  const boundary = `mixed_${randomUUID()}`;
  const alternative = `alternative_${randomUUID()}`;
  const body = [`--${alternative}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(text)),
  `--${alternative}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(html)), `--${alternative}--`];
  const related = `related_${randomUUID()}`;
  const logo = await readMailLogo();
  const relatedBody = [`--${related}`, `Content-Type: multipart/alternative; boundary="${alternative}"`, "", ...body,
  `--${related}`, "Content-Type: image/png", "Content-Transfer-Encoding: base64", `Content-ID: <${logoCid}>`, 'Content-Disposition: inline; filename="isotipo.png"', "", base64Lines(logo), `--${related}--`, ""];
  const files = attachment ? [attachment, ...attachments] : attachments;
  const raw = files.length ? [...headers, `Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`, `Content-Type: multipart/related; boundary="${related}"`, "", ...relatedBody,
  ...files.flatMap((file) => [`--${boundary}`, `Content-Type: ${file.mimeType ?? "application/pdf"}`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; ${attachmentName(file.filename)}`, "", base64Lines(file.content)]), `--${boundary}--`, ""].join("\r\n")
    : [...headers, `Content-Type: multipart/related; boundary="${related}"`, "", ...relatedBody].join("\r\n");
  return raw;
}
