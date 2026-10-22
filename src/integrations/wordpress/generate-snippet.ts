import { renderWordPressEmbed } from "@/integrations/wordpress/render";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { url: { type: "string" }, output: { type: "string" } } });
if (!values.url) throw new Error("Indica --url https://DOMINIO_DEL_SISTEMA/pedido.");
const html = await renderWordPressEmbed(values.url);
if (values.output) { await writeFile(values.output, html); console.log("Bloque HTML generado."); }
else process.stdout.write(`${html}\n`);
