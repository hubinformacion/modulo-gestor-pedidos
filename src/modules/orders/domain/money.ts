const currencyFormat = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export function toCents(value: string): number {
  if (!/^[0-9]{1,10}(\.[0-9]{1,2})?$/.test(value)) throw new Error("Importe no válido.");
  const [soles, decimals = ""] = value.split(".");
  const cents = Number(soles) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Importe fuera de rango.");
  return cents;
}

export function formatMoney(cents: number): string {
  return currencyFormat.format(cents / 100);
}

export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Importe fuera de rango.");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
