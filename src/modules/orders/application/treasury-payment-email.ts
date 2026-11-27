import { sendStandaloneMail } from "@/integrations/email/send";
import { readSmallDriveFile } from "@/integrations/google/drive";
import {
  claimTreasuryPaymentNotice, readTreasuryPaymentNotice, recordTreasuryPaymentNoticeResult,
} from "@/modules/orders/data/treasury-payment-notices";
import { receiptMimeType } from "@/modules/orders/domain/receipt";
import { maxReceiptBytes } from "@/modules/orders/domain/receipt-upload";
import { reportServerError, safeErrorDetails } from "@/shared/logging/server-diagnostics";
import { createHash } from "node:crypto";
import "server-only";
import { buildTreasuryPaymentMail } from "./treasury-payment-mail-content";

export async function deliverTreasuryPaymentNotice(id: string) {
  let claimed = false;
  let accepted = false;
  try {
    const record = await readTreasuryPaymentNotice(id);
    if (!record?.notice.recipient) return false;
    const { notice, order, receipt, items } = record;
    const recipient = record.notice.recipient;
    if (!receipt.hash || !receipt.size || !items.length) throw new Error("TREASURY_NOTICE_DATA_INVALID");
    const content = await readSmallDriveFile(receipt.driveFileId, maxReceiptBytes);
    const mimeType = receiptMimeType(content);
    if (!mimeType || mimeType !== receipt.mimeType || content.length !== receipt.size
      || createHash("sha256").update(content).digest("hex") !== receipt.hash) {
      throw new Error("TREASURY_VOUCHER_INVALID");
    }

    const universidad = notice.imprint === "universidad";
    const logoCid = `treasury-payment-${id}@fondoeditorial.continental.edu.pe`;
    const mail = buildTreasuryPaymentMail({
      ...order, logoCid, items, imprint: notice.imprint,
      subtotal: universidad ? order.subtotalUniversidad : order.subtotalInstituto,
      shipping: universidad ? order.shippingUniversidad : order.shippingInstituto,
      total: universidad ? order.totalUniversidad : order.totalInstituto,
    });
    claimed = await claimTreasuryPaymentNotice(id, notice.orderId, notice.imprint, recipient);
    if (!claimed) return false;
    const sent = await sendStandaloneMail({
      ...mail, logoCid, to: [recipient],
      attachments: [{ filename: receipt.fileName.toWellFormed(), mimeType, content }],
    }, "gmail");
    accepted = true;
    if (!sent.id || !sent.threadId) throw new Error("TREASURY_GMAIL_ACK_UNAVAILABLE");
    await recordTreasuryPaymentNoticeResult(id, "ENVIANDO", "ENVIADO", { id: sent.id, threadId: sent.threadId });
    return true;
  } catch (error) {
    reportServerError("treasury_payment_notice.delivery", error);
    const providerStatus = safeErrorDetails(error).status;
    const rejected = [400, 401, 403, 404, 413, 429].includes(providerStatus ?? 0);
    const outcome = claimed && (accepted || !rejected) ? "INCIERTO" : "ERROR";
    try { await recordTreasuryPaymentNoticeResult(id, claimed ? "ENVIANDO" : "NO_ENVIADO", outcome); }
    catch (auditError) { reportServerError("treasury_payment_notice.audit", auditError); }
    return false;
  }
}
