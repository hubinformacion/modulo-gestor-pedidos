// CCI is stored canonically; display grouping is shared by forms and snapshots.
export function formatCci(value: string) {
  const digits = value.replace(/[ -]/g, "");
  return /^\d{20}$/.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 18)}-${digits.slice(18)}` : value;
}
