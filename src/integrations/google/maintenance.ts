import { synchronizeDriveReaders } from "@/integrations/google/manager-readers";
import { reportServerError } from "@/shared/logging/server-diagnostics";
import "server-only";

// Daily security maintenance only. Never reads or delivers email events.
export async function processBackgroundJobs() {
  try { await synchronizeDriveReaders(); return { permissionsSynced: true }; }
  catch (error) { reportServerError("jobs.drive.access", error); throw error; }
}
