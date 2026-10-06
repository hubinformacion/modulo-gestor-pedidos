import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { embedUrlSchema, renderWordPressEmbed } from "./render";

const { values } = parseArgs({ options: { url: { type: "string", default: "http://localhost:3000/pedido" }, port: { type: "string", default: "3001" } } });
const url = embedUrlSchema.parse(values.url);
const port = z.coerce.number().int().min(1024).max(65535).parse(values.port);
const [page, block] = await Promise.all([
  readFile(new URL("./wordpress-simulator.html", import.meta.url), "utf8"), renderWordPressEmbed(url),
]);
const html = page.replace("__EMBED_BLOCK__", block);
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method !== "GET" || request.url !== "/") { response.writeHead(404); response.end(); return; }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(html);
});
server.listen(port, () => console.log(`Simulador: http://localhost:${port}\nOrigen de aplicación: ${new URL(url).origin}\nConfigura WORDPRESS_ORIGINS=http://localhost:${port} y reinicia Next antes de incrustar.`));
server.on("error", () => { console.error("No se pudo iniciar el simulador. Comprueba el puerto."); process.exitCode = 1; });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close());
