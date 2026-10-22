export function courierEstimate(zone: string | null | undefined) {
  if (zone === "lima_callao") return "Plazo aproximado del courier: 3 días hábiles para Lima/Callao, desde el despacho.";
  if (zone === "provincia") return "Plazo aproximado del courier: 5 días hábiles para provincia, desde el despacho.";
  return "Plazo aproximado desde el despacho: Lima/Callao 3 días hábiles; provincia 5 días hábiles.";
}
