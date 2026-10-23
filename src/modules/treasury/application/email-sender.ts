import type { MailAudience } from "@/integrations/email/types";
import { sendOrderMessage } from "@/modules/orders/application/email-sender";
import type { getTrackedOrder } from "@/modules/orders/data/tracking";
import { getPublicOrigin } from "@/shared/config/application";
import "server-only";
type Tracking = NonNullable<Awaited<ReturnType<typeof getTrackedOrder>>>;
export async function sendCajaEmail(tracking: Tracking, audience: MailAudience, notificationId: string, html: string, text: string, eventCreatedAt: Date) {
  const logoCid = `brand-caja-${notificationId}@${new URL(getPublicOrigin()).hostname}`;
  return sendOrderMessage({ tracking, audience, notificationId, html, text, logoCid, eventCreatedAt });
}
