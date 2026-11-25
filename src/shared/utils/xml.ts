import { SaxesParser } from "saxes";
import "server-only";

export function isWellFormedXml(bytes: Uint8Array) {
  try {
    const parser = new SaxesParser({ xmlns: true });
    parser.on("doctype", () => { throw new Error("XML_DOCTYPE_NOT_ALLOWED"); });
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" :
      bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
    parser.write(new TextDecoder(encoding, { fatal: true }).decode(bytes)).close();
    return true;
  } catch {
    return false;
  }
}
