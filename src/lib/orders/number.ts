// Display only: stored counters, order numbers and historical threads stay intact.
export function formatRequestNumber(value: string | number): string {
  return String(value).replace(/^0+(?=\d)/, "").padStart(3, "0");
}
export function formatOrderNumber(value: string): string {
  const match = /^(\d+)-(\d{4})$/.exec(value);
  return match ? `${formatRequestNumber(match[1])}-${match[2]}` : value;
}
