import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getMailProvider, getMailLogoUrl, type MailProvider } from "@/shared/config/mail";
import { sendRawMail } from "@/integrations/google/gmail";
import { buildEmailMessage } from "./message";
import { sendEndpointMail } from "./endpoint";
import type { PdfAttachment } from "./types";

export type SentMail = { id: string | null; threadId: string | null; provider: MailProvider; providerMessageId: string | null };
export type StandaloneMail = { to: string[]; cc?: string[]; bcc?: string[]; subject: string; html: string; text: string; attachments?: PdfAttachment[]; logoCid: string };

export function formatMailSubject(subject: string): string {
  if (/[\r\n\0]/.test(subject)) throw new Error("INVALID_SUBJECT_HEADER");
  return subject.startsWith("=?") ? subject : `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
}

export async function sendStandaloneMail(input: StandaloneMail, provider: MailProvider = getMailProvider()): Promise<SentMail> {
  const to = z.array(z.email()).min(1).parse(input.to);
  const cc = z.array(z.email()).parse(input.cc ?? []);
  const bcc = z.array(z.email()).parse(input.bcc ?? []);
  formatMailSubject(input.subject);
  if (provider === "endpoint") {
    const sent = await sendEndpointMail({ ...input, to, cc, bcc, html: input.html.replaceAll(`cid:${input.logoCid}`, getMailLogoUrl()) });
    return { id: null, threadId: null, provider, ...sent };
  }
  const from = z.email().parse(process.env.GOOGLE_OWNER_EMAIL);
  const headers = [`From: Fondo Editorial <${from}>`, `To: ${to.join(", ")}`, ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []), ...(bcc.length ? [`Bcc: ${bcc.join(", ")}`] : []),
    `Subject: ${formatMailSubject(input.subject)}`, `Date: ${new Date().toUTCString()}`, `Message-ID: <${randomUUID()}@mail.invalid>`, "MIME-Version: 1.0"];
  const raw = await buildEmailMessage({ headers, html: input.html, text: input.text, attachments: input.attachments, logoCid: input.logoCid });
  const sent = await sendRawMail(raw);
  return { ...sent, provider, providerMessageId: sent.id };
}
