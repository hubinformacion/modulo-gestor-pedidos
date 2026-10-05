import "server-only";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { drive } from "googleapis/build/src/apis/drive/index.js";
import { gmail } from "googleapis/build/src/apis/gmail/index.js";
import { z } from "zod";
import { googleConfigured, getOrderBankAccounts, getPublicOrigin, readOrderPaymentGuide } from "@/lib/payments/config";
import { formatMoney, toCents } from "@/lib/orders/money";
import { imprintNames } from "@/lib/orders/types";
import type { getTrackedOrder } from "@/lib/orders/tracking";

function ownerAuth() {
  if (!googleConfigured()) throw new Error("GOOGLE_NOT_CONFIGURED");
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

async function retryOnce<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch {
    try { return await operation(); }
    catch { throw new Error("GOOGLE_OPERATION_FAILED"); }
  }
}

export async function reserveDriveFileId() {
  return retryOnce(async () => {
    const response = await drive({ version: "v3", auth: ownerAuth() }).files.generateIds({ count: 1, space: "drive", type: "files" }, { timeout: 15_000, retry: false });
    if (!response.data.ids?.[0]) throw new Error("NO_DRIVE_ID");
    return response.data.ids[0];
  });
}

export async function uploadFileToDrive({ id, name, mimeType, bytes }: { id: string; name: string; mimeType: string; bytes: Buffer }) {
  const api = drive({ version: "v3", auth: ownerAuth() });
  return retryOnce(async () => {
    // Checking the reserved ID makes retries safe after an ambiguous create response.
    let exists = false;
    try {
      await api.files.get({ fileId: id, fields: "id" }, { timeout: 15_000, retry: false });
      exists = true;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? Number(error.code) : 0;
      if (code !== 404) throw error;
    }
    if (!exists) await api.files.create({
      requestBody: { id, name, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!] },
      media: { mimeType, body: Readable.from(bytes) }, fields: "id",
    }, { timeout: 20_000, retry: false });
    await api.permissions.create({ fileId: id, requestBody: { type: "anyone", role: "reader" } }, { timeout: 15_000, retry: false });
    const response = await api.files.get({ fileId: id, fields: "webViewLink" }, { timeout: 15_000, retry: false });
    return { driveFileId: id, driveViewUrl: response.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view` };
  });
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
function base64Lines(value: Buffer) { return value.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? ""; }

type Tracking = NonNullable<Awaited<ReturnType<typeof getTrackedOrder>>>;
const emailTemplates = {
  solo_universidad: "Realiza un depósito a la cuenta de Universidad Continental según la guía adjunta.",
  solo_instituto: "Realiza un depósito a la cuenta de Instituto Continental según la guía adjunta.",
  mixto: "Realiza dos depósitos independientes: uno para Universidad Continental y otro para Instituto Continental. El envío corresponde únicamente a Universidad Continental.",
} as const;

export async function sendOrderConfirmationEmail(tracking: Tracking) {
  const { order, items } = tracking;
  const from = z.email().parse(process.env.GOOGLE_OWNER_EMAIL);
  const to = z.email().parse(order.customerEmail);
  const link = `${getPublicOrigin()}/seguimiento/${order.trackingToken}`;
  const banks = await getOrderBankAccounts(order.paymentAccounts);
  if (!banks) throw new Error("BANKS_NOT_CONFIGURED");
  const guide = await readOrderPaymentGuide(order);
  const applicable = (["universidad", "instituto"] as const).filter((imprint) => imprint === "universidad" ? order.paymentStatusUniversidad !== "NO_APLICA" : order.paymentStatusInstituto !== "NO_APLICA");
  const bankHtml = applicable.map((imprint) => {
    const accounts = banks[imprint];
    const amount = imprint === "universidad" ? order.totalUniversidad : order.totalInstituto;
    return `<h3>${imprintNames[imprint]}: ${formatMoney(toCents(amount))}</h3><p>Elige una de estas cuentas para el depósito de este sello:</p>${accounts.map((bank) => `<p>${escapeHtml(bank.bank)} · ${escapeHtml(bank.holder)}<br>Cuenta en soles: ${escapeHtml(bank.account)}<br>CCI: ${escapeHtml(bank.cci)}</p>`).join("")}`;
  }).join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#191922;line-height:1.6"><h1>Pedido ${order.orderNumber}</h1><p>Hola, ${escapeHtml(order.customerName)}.</p><p>Registramos tu pedido. ${emailTemplates[order.orderType]}</p><ul>${items.map((item) => `<li>${item.quantity} × ${escapeHtml(item.title)} — ${formatMoney(toCents(item.subtotal))}</li>`).join("")}</ul><p>Envío: ${formatMoney(toCents(order.shippingCost))}<br><strong>Total: ${formatMoney(toCents(order.total))}</strong></p>${bankHtml}<p>Entrega: ${escapeHtml(order.deliveryAddress)}</p><p><a href="${link}">Consultar el pedido y adjuntar comprobantes</a></p><p>La preparación comienza cuando se verifican los pagos requeridos.</p></div>`;
  const text = `Pedido ${order.orderNumber}\n${emailTemplates[order.orderType]}\nTotal: ${formatMoney(toCents(order.total))}\nSeguimiento y comprobantes: ${link}`;
  const boundary = `mixed_${randomUUID()}`;
  const alternative = `alternative_${randomUUID()}`;
  const raw = [
    `From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(`Confirmación del pedido ${order.orderNumber}`).toString("base64")}?=`,
    `Message-ID: <pedido-${order.id}@${new URL(getPublicOrigin()).hostname}>`, "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`, "", `--${alternative}`,
    "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(text)),
    `--${alternative}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(html)), `--${alternative}--`,
    `--${boundary}`, `Content-Type: application/pdf; name="${guide.filename}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${guide.filename}"`, "", base64Lines(guide.content), `--${boundary}--`, "",
  ].join("\r\n");
  return retryOnce(async () => {
    const response = await gmail({ version: "v1", auth: ownerAuth() }).users.messages.send({ userId: "me", requestBody: { raw: Buffer.from(raw).toString("base64url") } }, { timeout: 20_000, retry: false });
    if (!response.data.id) throw new Error("NO_GMAIL_ID");
    return response.data.id;
  });
}
