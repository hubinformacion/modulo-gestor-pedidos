import { readFile } from "node:fs/promises";
import { join } from "node:path";
import "server-only";

export async function readMailLogo() { return readFile(join(process.cwd(), "public/isotipo-blanco.png")); }
