import { safeErrorDetails } from "@/shared/logging/server-diagnostics";
import { drive } from "googleapis/build/src/apis/drive/index.js";
import { Readable } from "node:stream";
import "server-only";
import { ownerAuth, retryOnce } from "./auth";
export async function reserveDriveFileId() {
  return retryOnce(async () => {
    const response = await drive({ version: "v3", auth: ownerAuth() }).files.generateIds({ count: 1, space: "drive", type: "files" }, { timeout: 15_000, retry: false });
    if (!response.data.ids?.[0]) throw new Error("NO_DRIVE_ID");
    return response.data.ids[0];
  });
}
export async function uploadFileToDrive({ id, name, mimeType, bytes }: { id: string; name: string; mimeType: string; bytes: Buffer }) {
  const api = drive({ version: "v3", auth: ownerAuth() });
  let stage = "drive.lookup";
  return retryOnce(async () => {
    // Reserved IDs reconcile ambiguous uploads without creating another file.
    stage = "drive.lookup";
    let exists = false;
    try {
      await api.files.get({ fileId: id, fields: "id" }, { timeout: 15_000, retry: false });
      exists = true;
    } catch (error) {
      if (safeErrorDetails(error).status !== 404) throw error;
    }
    if (!exists) {
      stage = "drive.upload";
      await api.files.create({ requestBody: { id, name, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!] }, media: { mimeType, body: Readable.from(bytes) }, fields: "id" }, { timeout: 20_000, retry: false });
    }
    stage = "drive.read_link";
    const response = await api.files.get({ fileId: id, fields: "webViewLink" }, { timeout: 15_000, retry: false });
    return { driveFileId: id, driveViewUrl: response.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view` };
  }, () => stage);
}
export async function readFileFromDrive(fileId: string): Promise<Readable> {
  return retryOnce(async () => {
    const response = await drive({ version: "v3", auth: ownerAuth() }).files.get({ fileId, alt: "media" }, { responseType: "stream", timeout: 20_000, retry: false });
    return response.data as unknown as Readable;
  }, "drive.download");
}
