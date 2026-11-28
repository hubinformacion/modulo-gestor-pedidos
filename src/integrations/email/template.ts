export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }

const primary = "#6802c1";
const border = "#e4e4e7";
const text = "#18181b";
const muted = "#52525b";

export type EmailDetail = readonly [label: string, value: string, emphasis?: "code" | "strong" | "status"];

export function emailDetails(details: readonly EmailDetail[]) {
  const rows = details.filter(([, value]) => value);
  if (!rows.length) return "";
  return `<table width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-top:1px solid ${border};border-bottom:1px solid ${border};border-collapse:collapse">
    ${rows.map(([label, value, emphasis], index) => {
      const line = index + 1 < rows.length ? "border-bottom:1px solid #f4f4f5;" : "";
      const valueStyle = emphasis === "code" ? "font:600 13px/1.5 ui-monospace,Menlo,Consolas,monospace;" :
        emphasis === "strong" ? "font-weight:600;" : emphasis === "status" ? `font-weight:600;color:${primary};` : "";
      return `<tr><th scope="row" align="left" valign="top" width="38%" style="${line}padding:10px 12px 10px 0;font-size:13px;line-height:1.5;font-weight:400;color:${muted}">${escapeHtml(label)}</th>
      <td valign="top" style="${line}padding:10px 0;font-size:13px;line-height:1.5;overflow-wrap:anywhere;${valueStyle}">${escapeHtml(value)}</td></tr>`;
    }).join("")}
  </table>`;
}

export function emailNote(content: string) {
  return `<p style="margin:0;border-top:1px solid #f4f4f5;padding-top:16px;font-size:12px;line-height:1.6;color:${muted}">${escapeHtml(content)}</p>`;
}

export function emailAction(link: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px"><tr><td bgcolor="${primary}" style="border-radius:4px;background:${primary}">
    <a href="${escapeHtml(link)}" style="display:inline-block;padding:11px 20px;color:#fff;font-size:13px;font-weight:600;line-height:1.4;text-decoration:none">${escapeHtml(label)} &rarr;</a>
  </td></tr></table>`;
}

export function emailShell({ title, logoCid, content }: { title: string; logoCid: string; content: string }) {
  const year = new Intl.DateTimeFormat("es-PE", { year: "numeric", timeZone: "America/Lima" }).format(new Date());
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>@media(max-width:480px){.mail-outer{padding:16px 8px!important}.mail-pad{padding-left:16px!important;padding-right:16px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;color:${text};font-family:-apple-system,BlinkMacSystemFont,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f4f4f5" style="background:#f4f4f5">
    <tr><td align="center" class="mail-outer" style="padding:40px 16px">
      <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid ${border};border-radius:4px;border-collapse:separate;background:#fff">
        <tr><td height="3" bgcolor="${primary}" style="height:3px;font-size:0;line-height:0;background:${primary}">&nbsp;</td></tr>
        <tr><td class="mail-pad" style="padding:18px 32px;border-bottom:1px solid ${border}">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
            <td align="left" valign="middle">
              <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="${primary}" style="padding:4px;border-radius:4px;background:${primary}">
                <img src="cid:${escapeHtml(logoCid)}" width="30" height="30" alt="Universidad Continental" style="display:block;width:30px;height:30px;border:0;color:#fff;font-size:8px">
              </td></tr></table>
            </td>
            <td align="right" valign="middle" style="padding-left:12px;font-size:12px;line-height:1.4;font-weight:600;color:${primary}">Hub de Información y Fondo Editorial</td>
          </tr></table>
        </td></tr>
        <tr><td class="mail-pad" bgcolor="#fafafa" style="padding:28px 32px;border-bottom:1px solid ${border};background:#fafafa">
          <p style="margin:0 0 6px;color:${primary};font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Módulo de Pedidos</p>
          <h1 style="margin:0;color:${text};font-size:20px;font-weight:600;line-height:1.3;letter-spacing:-.02em">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td class="mail-pad" style="padding:28px 32px 32px;color:${text};font-size:14px;line-height:1.6">${content}</td></tr>
        <tr><td class="mail-pad" bgcolor="${primary}" style="padding:16px 32px;background:${primary};color:#fff;font-size:12px;font-weight:500">&copy; ${year} Continental International Education</td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}
