export type PdfAttachment = { filename: string; content: Buffer };
export type MailAudience = { to: string[]; subject: string; threadId?: string | null; lastRfcMessageId?: string | null; references?: string[] };
