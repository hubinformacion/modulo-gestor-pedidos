import { gmail } from "googleapis/build/src/apis/gmail/index.js";
import "server-only";
import { ownerAuth, retryOnce } from "./auth";
export async function readSentMailHeaders(messageId: string) {
  return retryOnce(async () => {
    const response = await gmail({ version: "v1", auth: ownerAuth() }).users.messages.get({ userId: "me", id: messageId, format: "metadata", metadataHeaders: ["Message-ID", "Subject"], fields: "threadId,payload(headers)" }, { timeout: 15_000, retry: false });
    const headers = response.data.payload?.headers ?? [];
    const rfc = headers.find((item) => item.name?.toLowerCase() === "message-id")?.value?.trim();
    const subject = headers.find((item) => item.name?.toLowerCase() === "subject")?.value;
    if (!rfc || !/^<[^<>\s]+@[^<>\s]+>$/.test(rfc) || !subject || !response.data.threadId) throw new Error("INVALID_GMAIL_HEADERS");
    return { rfcMessageId: rfc, subjectHeader: subject, threadId: response.data.threadId };
  }, "gmail.metadata");
}

// Sending is attempted once. A timeout can mean Gmail accepted the message.
export async function sendRawMail(raw: string, threadId?: string | null) {
  const response = await gmail({ version: "v1", auth: ownerAuth() }).users.messages.send({ userId: "me", requestBody: { raw: Buffer.from(raw).toString("base64url"), ...(threadId ? { threadId } : {}) } }, { timeout: 20_000, retry: false });
  if (!response.data.id || !response.data.threadId) throw new Error("NO_GMAIL_ID");
  return { id: response.data.id, threadId: response.data.threadId };
}
