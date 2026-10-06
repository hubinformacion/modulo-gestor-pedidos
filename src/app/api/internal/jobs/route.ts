import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { processBackgroundJobs } from "@/lib/orders/background-jobs";
import { reportServerError } from "@/lib/server-diagnostics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(request: Request) {
  const parsed = z.string().min(32).safeParse(process.env.CRON_SECRET);
  const headers = { "Cache-Control": "private, no-store" };
  if (!parsed.success) return Response.json({ error: "JOBS_NOT_CONFIGURED" }, { status: 503, headers });
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${parsed.data}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  try { return Response.json(await processBackgroundJobs(), { headers }); }
  catch (error) { reportServerError("jobs.failed", error); return Response.json({ error: "JOBS_FAILED" }, { status: 503, headers }); }
}
