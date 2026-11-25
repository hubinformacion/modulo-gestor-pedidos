export type MailAttachment = { filename: string; content: Buffer; mimeType?: "application/pdf" | "application/xml" };
export type MailAudience = { to: string[]; subject: string; threadId?: string | null; lastRfcMessageId?: string | null; references?: string[] };
